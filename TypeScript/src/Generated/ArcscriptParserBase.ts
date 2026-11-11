import {
  Parser,
  ParserRuleContext,
  TerminalNode,
  Token,
  TokenStream,
} from 'antlr4';
import ArcscriptParser, {
  Argument_listContext,
  Identifier_listContext,
  IdentifierContext,
  Mention_attributesContext,
  Statement_assignmentContext,
  ComparisonExpressionContext,
  ExpressionContext,
  ParenthesizedExpressionContext,
  IdentifierExpressionContext,
  LiteralExpressionContext,
  FunctionCallExpressionContext,
} from './ArcscriptParser.js';
import ArcscriptContext from '../ArcscriptContext.js';

type ArcscriptParserOptions = {
  elementVisits: Record<string, number>;
  currentElement: string;
  declarations: ArcscriptContext;
};

type ArcscriptFunctionInfo = {
  minArgs: number;
  maxArgs: number | null;
  returnType?: 'number' | 'void';
  argType?: 'number' | 'variable' | 'mention';
  pure?: boolean;
};

export default class ArcscriptParserBase extends Parser {
  static arcscriptFunctionsInfo: Record<string, ArcscriptFunctionInfo> = {
    abs: { minArgs: 1, maxArgs: 1, returnType: 'number', pure: true },
    max: { minArgs: 2, maxArgs: null, returnType: 'number', pure: true },
    min: { minArgs: 2, maxArgs: null, returnType: 'number', pure: true },
    random: { minArgs: 0, maxArgs: 0, returnType: 'number' },
    roll: { minArgs: 1, maxArgs: 2, returnType: 'number' },
    round: { minArgs: 1, maxArgs: 1, returnType: 'number', pure: true },
    sqr: { minArgs: 1, maxArgs: 1, returnType: 'number', pure: true },
    sqrt: { minArgs: 1, maxArgs: 1, returnType: 'number', pure: true },
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

  declarations!: ArcscriptContext;
  elementVisits: Record<string, number> = {};
  currentElement: string = '';
  currentLine: number = 0;
  openTagEndPos: number = 0;

  constructor(input: TokenStream) {
    super(input);
  }

  setOptions(options: ArcscriptParserOptions) {
    this.declarations = options.declarations;
    this.elementVisits = options.elementVisits;
    this.currentElement = options.currentElement;
  }

  setLineStart(token: Token) {
    this.openTagEndPos = token.stop + 1;
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
        if (argListCtx instanceof Identifier_listContext) {
          argListCtx
            .identifier_list()
            .forEach(identifier => this.assertAssignable(identifier));
        }
      }
    }
  }

  assertVariable(identifierCtx: IdentifierContext) {
    const variableName = identifierCtx.getText();
    if (!this.declarations.resolve(variableName)) {
      this.notifyErrorListeners(
        `The variable ${variableName} does not exist`,
        identifierCtx.start,
        undefined
      );
    }
  }

  assertAssignable(identifierCtx: IdentifierContext) {
    if (
      this.declarations.resolve(identifierCtx.getText())?.kind === 'enumMember'
    ) {
      this.notifyErrorListeners(
        `Enum member ${identifierCtx.getText()} is read-only`,
        identifierCtx.start,
        undefined
      );
    }
    this.assertVariable(identifierCtx);
  }

  private expressionEnum(ctx: ExpressionContext): string | undefined {
    if (ctx instanceof ParenthesizedExpressionContext)
      return this.expressionEnum(ctx.expression());
    if (ctx instanceof IdentifierExpressionContext)
      return this.declarations.resolve(ctx.identifier().getText())?.enumId;
    return undefined;
  }

  private isConstantExpression(ctx: ExpressionContext): boolean {
    if (ctx instanceof IdentifierExpressionContext)
      return (
        this.declarations.resolve(ctx.identifier().getText())?.kind ===
        'enumMember'
      );
    if (ctx instanceof LiteralExpressionContext) return true;
    if (ctx instanceof FunctionCallExpressionContext) {
      const call = ctx.function_call();
      if (
        !ArcscriptParserBase.arcscriptFunctionsInfo[call.FNAME().getText()].pure
      )
        return false;
      if (call.identifier_list()) {
        return call
          .identifier_list()
          .identifier_list()
          .every(
            identifier =>
              this.declarations.resolve(identifier.getText())?.kind ===
              'enumMember'
          );
      }
      return (
        call
          .argument_list()
          ?.argument_list()
          .every(argument => {
            const expression = argument.expression();
            return !!expression && this.isConstantExpression(expression);
          }) ?? true
      );
    }
    return ctx
      .getTypedRuleContexts(ExpressionContext)
      .every(child => this.isConstantExpression(child));
  }

  // Called as assignments/comparisons are parsed, including unreachable branches.
  validateEnums(ctx: ParserRuleContext) {
    if (!this.declarations.hasEnums) return;
    if (ctx instanceof Statement_assignmentContext) {
      const enumId = this.declarations.resolve(
        ctx.assignable().getText()
      )?.enumId;
      if (
        enumId &&
        (!ctx.ASSIGN() || this.expressionEnum(ctx.expression()) !== enumId)
      ) {
        this.notifyErrorListeners(
          'Enum assignment requires a member or variable of the same enum',
          ctx.start,
          undefined
        );
      }
    }
    if (
      ctx instanceof ComparisonExpressionContext &&
      !(ctx.AND() || ctx.ANDKEYWORD() || ctx.OR() || ctx.ORKEYWORD())
    ) {
      const left = this.expressionEnum(ctx.expression(0));
      const right = this.expressionEnum(ctx.expression(1));
      if (left && right && left !== right) {
        this.notifyErrorListeners(
          'Cannot compare different enum types',
          ctx.start,
          undefined
        );
      }
      if (
        (left && !right && this.isConstantExpression(ctx.expression(1))) ||
        (right && !left && this.isConstantExpression(ctx.expression(0)))
      ) {
        this.notifyErrorListeners(
          'Enum comparisons with constants require a named member',
          ctx.start,
          undefined
        );
      }
      const enumId = left ?? right;
      if (
        enumId &&
        (ctx.LT() || ctx.GT() || ctx.LE() || ctx.GE()) &&
        this.declarations.enumType(enumId) !== 'integer'
      ) {
        this.notifyErrorListeners(
          'Only integer enums support ordering',
          ctx.start,
          undefined
        );
      }
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
