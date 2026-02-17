import { Parser, TerminalNode, Token, TokenStream } from 'antlr4';
import ArcscriptParser, {
  Argument_listContext,
  Mention_attributesContext,
  Variable_listContext,
} from './ArcscriptParser.js';
import { VarObject } from '../types.js';

type ArcscriptParserOptions = {
  varObjects: Record<string, VarObject>;
  elementVisits: Record<string, number>;
  currentElement: string;
};

type ArcscriptFunctionInfo = {
  minArgs: number;
  maxArgs: number | null;
  returnType?: 'number' | 'void';
};

export default class ArcscriptParserBase extends Parser {
  static arcscriptFunctionsInfo: Record<string, ArcscriptFunctionInfo> = {
    abs: { minArgs: 1, maxArgs: 1, returnType: 'number' },
    max: { minArgs: 2, maxArgs: null, returnType: 'number' },
    min: { minArgs: 2, maxArgs: null, returnType: 'number' },
    random: { minArgs: 0, maxArgs: 0, returnType: 'number' },
    roll: { minArgs: 1, maxArgs: 2, returnType: 'number' },
    round: { minArgs: 1, maxArgs: 1, returnType: 'number' },
    sqr: { minArgs: 1, maxArgs: 1, returnType: 'number' },
    sqrt: { minArgs: 1, maxArgs: 1, returnType: 'number' },
    visits: { minArgs: 0, maxArgs: 1, returnType: 'number' },
    show: { minArgs: 1, maxArgs: null, returnType: 'void' },
    reset: { minArgs: 1, maxArgs: null, returnType: 'void' },
    resetAll: { minArgs: 0, maxArgs: null, returnType: 'void' },
    resetVisits: { minArgs: 0, maxArgs: 0, returnType: 'void' },
  };

  varObjects: Record<string, VarObject> = {};
  elementVisits: Record<string, number> = {};
  currentElement: string = '';
  currentLine: number = 0;
  openTagEndPos: number = 0;

  constructor(input: TokenStream) {
    super(input);
  }

  setOptions(options: ArcscriptParserOptions) {
    this.varObjects = options.varObjects;
    this.elementVisits = options.elementVisits;
    this.currentElement = options.currentElement;
  }

  setLineStart(token: Token) {
    this.openTagEndPos = token.start + token.text.length;
  }

  assertFunctionArguments(
    token: Token,
    argListCtx: Argument_listContext | Variable_listContext | null = null
  ) {
    let argListLength = 0;

    if (argListCtx) {
      if (argListCtx instanceof Argument_listContext) {
        argListLength = argListCtx.argument_list().length;
      } else if (argListCtx instanceof Variable_listContext) {
        argListLength = argListCtx.VARIABLE_list().length;
      }
    }
    const min = ArcscriptParserBase.arcscriptFunctionsInfo[token.text].minArgs;
    const max = ArcscriptParserBase.arcscriptFunctionsInfo[token.text].maxArgs;

    if (
      (min !== null && argListLength < min) ||
      (max !== null && argListLength > max)
    ) {
      this.notifyErrorListeners(
        `Invalid number of arguments for function ${token.text}`,
        token,
        undefined
      );
    }
  }

  assertVariable(variableToken: Token) {
    const variableName = variableToken.text;
    if (
      !Object.values(this.varObjects).find(
        variable => variable.name === variableName
      )
    ) {
      this.notifyErrorListeners(
        `The variable ${variableName} does not exist`,
        variableToken,
        undefined
      );
    }
  }

  assertMention(attrListCtx: Mention_attributesContext[]) {
    const attrs: Record<
      string,
      {
        ctx: Mention_attributesContext;
        terminalNode: TerminalNode;
        value: string;
      }
    > = {};
    attrListCtx.forEach(ctx => {
      const terminalNode = ctx.getToken(ArcscriptParser.ATTR_NAME, 0);
      const attrName = terminalNode.getText();
      let attrValue =
        ctx.getToken(ArcscriptParser.ATTR_VALUE, 0)?.getText() ?? '';
      if (attrValue.startsWith('"') && attrValue.endsWith('"')) {
        attrValue = attrValue.slice(1, -1);
      } else if (attrValue.startsWith("'") && attrValue.endsWith("'")) {
        attrValue = attrValue.slice(1, -1);
      }
      attrs[attrName] = { ctx, terminalNode, value: attrValue };
    });
    const classList = attrs.class.value.split(' ');
    if (!classList.includes('mention')) {
      this.notifyErrorListeners(
        `Invalid mention type`,
        attrs.class.terminalNode.symbol,
        undefined
      );
    }
    if (attrs['data-type'].value !== 'element') {
      this.notifyErrorListeners(
        `Invalid mention type`,
        attrs['data-type'].terminalNode.symbol,
        undefined
      );
    }

    if (!(attrs['data-id'].value in this.elementVisits)) {
      this.notifyErrorListeners(
        `Invalid element mention`,
        attrs['data-id'].terminalNode.symbol,
        undefined
      );
    }
    return true;
  }
}
