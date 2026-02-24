import { Parser, TerminalNode, Token, TokenStream } from 'antlr4';
import ArcscriptParser, {
  Argument_listContext,
  Function_callContext,
  Identifier_listContext,
  IdentifierContext,
  Mention_attributesContext,
} from './ArcscriptParser.js';
import { ArcscriptStateDef, ScopedVariableDef, VarDef } from '../types.js';

type ArcscriptParserOptions = {
  arcscriptVariables: ArcscriptStateDef;
  elementVisits: Record<string, number>;
  currentElement: string;
};

type ArcscriptFunctionInfo = {
  minArgs: number;
  maxArgs: number | null;
  returnType?: 'number' | 'void';
  argType?: 'number' | 'variable' | 'mention';
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
    reset: {
      minArgs: 1,
      maxArgs: null,
      returnType: 'void',
      argType: 'variable',
    },
    resetAll: {
      minArgs: 0,
      maxArgs: null,
      returnType: 'void',
      argType: 'variable',
    },
    resetVisits: { minArgs: 0, maxArgs: 0, returnType: 'void' },
  };

  arcscriptVariableNames: string[] = [];
  elementVisits: Record<string, number> = {};
  currentElement: string = '';
  currentLine: number = 0;
  openTagEndPos: number = 0;

  constructor(input: TokenStream) {
    super(input);
  }

  setOptions(options: ArcscriptParserOptions) {
    const variableNames: string[] = [];
    Object.entries(options.arcscriptVariables).forEach(([scope, vars]) => {
      if (scope === 'global') {
        const globalVarNames = Object.values(
          vars as Record<string, VarDef>
        ).map(variable => variable.name);
        variableNames.push(...globalVarNames);
      } else {
        Object.entries(vars as Record<string, ScopedVariableDef>).forEach(
          ([parentId, scopedVars]) => {
            variableNames.push(
              ...Object.values(scopedVars).map(
                variable => `${parentId}.${variable.name}`
              )
            );
          }
        );
      }
    });
    this.arcscriptVariableNames = variableNames;
    this.elementVisits = options.elementVisits;
    this.currentElement = options.currentElement;
  }

  setLineStart(token: Token) {
    this.openTagEndPos = token.start + token.text.length;
  }

  assertFunctionArguments(
    token: Token,
    argListCtx: Argument_listContext | Identifier_listContext | null = null
  ) {
    let argListLength = 0;

    if (argListCtx) {
      if (argListCtx instanceof Argument_listContext) {
        argListLength = argListCtx.argument_list().length;
      } else if (argListCtx instanceof Identifier_listContext) {
        argListLength = argListCtx.identifier_list().length;
      }
    }

    const { minArgs, maxArgs, argType } =
      ArcscriptParserBase.arcscriptFunctionsInfo[token.text];

    if (
      (minArgs !== null && argListLength < minArgs) ||
      (maxArgs !== null && argListLength > maxArgs)
    ) {
      this.notifyErrorListeners(
        `Invalid number of arguments for function ${token.text}`,
        token,
        undefined
      );
    }

    if (argType && argListCtx) {
      if (argType === 'variable') {
        if (!(argListCtx instanceof Identifier_listContext)) {
          this.notifyErrorListeners(
            `Invalid argument type for function ${token.text}. Expected variables.`,
            token,
            undefined
          );
        }
      }
    }
  }

  assertFunctionReturnValue(
    fncCtx: Function_callContext,
    hasReturnValue = true
  ) {
    const functionName = fncCtx.FNAME().getText();
    const token = fncCtx.FNAME().symbol;
    const { returnType } =
      ArcscriptParserBase.arcscriptFunctionsInfo[functionName];
    if (hasReturnValue) {
      if (returnType === 'void') {
        this.notifyErrorListeners(
          `The function ${functionName} does not return a value`,
          token,
          undefined
        );
      }
    } else if (returnType !== 'void') {
      this.notifyErrorListeners(
        `The function ${functionName} returns a value that is not being used`,
        token,
        undefined
      );
    }
  }

  assertVariable(identifierCtx: IdentifierContext) {
    const variableName = identifierCtx.getText();
    if (!this.arcscriptVariableNames.includes(variableName)) {
      this.notifyErrorListeners(
        `The variable ${variableName} does not exist`,
        identifierCtx.start,
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
