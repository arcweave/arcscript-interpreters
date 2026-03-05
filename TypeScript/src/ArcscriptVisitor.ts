import BigNumber from 'bignumber.js';
import ArcscriptParserVisitor from './Generated/ArcscriptParserVisitor.js';
import ArcscriptFunctions, {
  ArcscriptNonVoidFunctionKeys,
} from './ArcscriptFunctions.js';
import ArcscriptState from './ArcscriptState.js';
import { RuntimeError } from './errors/index.js';
import { MentionResult, VarValue } from './types.js';
import {
  AdditiveExpressionContext,
  Argument_listContext,
  ArgumentContext,
  AssignableContext,
  Assignment_segmentContext,
  BlockquoteContext,
  ComparisonExpressionContext,
  Conditional_sectionContext,
  ConditionContext,
  Else_if_clauseContext,
  Else_if_sectionContext,
  Else_sectionContext,
  ExpressionContext,
  Function_call_segmentContext,
  Function_callContext,
  FunctionCallExpressionContext,
  Identifier_listContext,
  IdentifierContext,
  IdentifierExpressionContext,
  If_clauseContext,
  If_sectionContext,
  InputContext,
  LiteralContext,
  LiteralExpressionContext,
  Mention_attributesContext,
  MentionContext,
  MultiplicativeExpressionContext,
  Numeric_literalContext,
  ParagraphContext,
  ParenthesizedExpressionContext,
  Script_sectionContext,
  Statement_assignmentContext,
  UnaryExpressionContext,
} from './Generated/ArcscriptParser.js';
import ArcscriptVariable from './ArcscriptVariable.js';
import ArcscriptParserBase from './Generated/ArcscriptParserBase.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default class ArcscriptVisitor extends ArcscriptParserVisitor<any> {
  state: ArcscriptState;
  functions: ArcscriptFunctions;

  constructor(state: ArcscriptState) {
    super();

    this.state = state;

    this.functions = new ArcscriptFunctions(this.state);
  }

  visitInput = (ctx: InputContext) => {
    if (ctx.script()) {
      return { script: this.visitChildren(ctx.script()) };
    }

    return this.visitCondition(ctx.condition());
  };

  visitCondition = (ctx: ConditionContext) => {
    return {
      condition: !!this.visitExpression(ctx.expression()),
    };
  };

  visitScript_section = (ctx: Script_sectionContext) => {
    if (!ctx) {
      return null;
    }

    if (
      Array.isArray(ctx.blockquote_list()) &&
      ctx.blockquote_list().length > 0
    ) {
      const result = ctx.blockquote_list().map(blockquoteContext => {
        return this.visitBlockquote(blockquoteContext);
      });
      return result;
    }

    if (
      Array.isArray(ctx.paragraph_list()) &&
      ctx.paragraph_list().length > 0
    ) {
      const result = ctx.paragraph_list().map(paragraphContext => {
        return this.visitParagraph(paragraphContext);
      });
      return result;
    }

    return this.visitChildren(ctx);
  };

  visitParagraph = (ctx: ParagraphContext) => {
    this.state.pushOutput(ctx.getText(), false);
    return ctx.getText();
  };

  visitBlockquote = (ctx: BlockquoteContext) => {
    this.state.addBlockquoteStart();
    this.visitChildren(ctx);
    this.state.addBlockquoteEnd();

    return ctx.getText();
  };

  visitAssignment_segment = (ctx: Assignment_segmentContext) => {
    this.state.addScript();
    return this.visitStatement_assignment(ctx.statement_assignment());
  };

  visitFunction_call_segment = (ctx: Function_call_segmentContext) => {
    this.state.addScript();
    return this.visitFunction_call(ctx.function_call());
  };

  visitConditional_section = (ctx: Conditional_sectionContext) => {
    this.state.addScript();
    this.state.incrConditionDepth();
    const if_section = this.visitIf_section(ctx.if_section());
    if (if_section) {
      this.state.addScript();
      this.state.decrConditionDepth();
      return if_section;
    }
    const result = ctx.else_if_section_list().find(else_if_section => {
      const elif_section = this.visitElse_if_section(else_if_section);
      if (elif_section) {
        return true;
      }
      return false;
    });

    if (result) {
      this.state.addScript();
      this.state.decrConditionDepth();
      return result;
    }

    if (ctx.else_section()) {
      const elseResult = this.visitElse_section(ctx.else_section());
      this.state.addScript();
      this.state.decrConditionDepth();
      return elseResult;
    }
    this.state.addScript();
    this.state.decrConditionDepth();
    return null;
  };

  visitIf_section = (ctx: If_sectionContext) => {
    const result = this.visitIf_clause(ctx.if_clause());
    if (result) {
      return this.visitChildren(ctx.script());
    }

    return null;
  };

  visitElse_if_section = (ctx: Else_if_sectionContext) => {
    const result = this.visitElse_if_clause(ctx.else_if_clause());
    if (result) {
      return this.visitChildren(ctx.script());
    }
    return null;
  };

  visitElse_section = (ctx: Else_sectionContext) => {
    return this.visitChildren(ctx.script());
  };

  visitIf_clause = (ctx: If_clauseContext): boolean => {
    return this.visitExpression(ctx.expression()) as boolean;
  };

  visitElse_if_clause = (ctx: Else_if_clauseContext): boolean => {
    return this.visitExpression(ctx.expression()) as boolean;
  };

  visitStatement_assignment = (ctx: Statement_assignmentContext) => {
    const assignable = this.visitAssignable(ctx.assignable());

    let variableValue = assignable.getValue();
    let expressionValue = this.visitExpression(ctx.expression());
    if (expressionValue === undefined) {
      throw new RuntimeError('The right part of the assigment has no value');
    }
    let result: VarValue = 0;
    if (
      typeof variableValue === 'string' ||
      typeof expressionValue === 'string'
    ) {
      if (ctx.ASSIGNADD()) {
        result = ((variableValue as string) + expressionValue) as string;
      } else if (ctx.ASSIGN()) {
        result = expressionValue;
      } else {
        throw new RuntimeError('Invalid operation with string');
      }

      assignable.setValue(result);
      return null;
    }
    if (
      ctx.ASSIGNADD() ||
      ctx.ASSIGNSUB() ||
      ctx.ASSIGNMUL() ||
      ctx.ASSIGNMOD() ||
      ctx.ASSIGNDIV()
    ) {
      if (typeof variableValue === 'boolean') {
        variableValue = variableValue ? 1 : 0;
      }
      if (typeof expressionValue === 'boolean') {
        expressionValue = expressionValue ? 1 : 0;
      }
    }

    const leftValue = new BigNumber(variableValue as number);
    const rightValue = new BigNumber(expressionValue as number);

    if (ctx.ASSIGNADD()) {
      result = leftValue.plus(rightValue).toNumber();
    } else if (ctx.ASSIGNSUB()) {
      result = leftValue.minus(rightValue).toNumber();
    } else if (ctx.ASSIGNMUL()) {
      result = leftValue.multipliedBy(rightValue).toNumber();
    } else if (ctx.ASSIGNDIV()) {
      result = leftValue.dividedBy(rightValue).toNumber();
      if (!Number.isFinite(result)) {
        throw new RuntimeError(`Invalid division by zero`);
      }
    } else if (ctx.ASSIGNMOD()) {
      result = leftValue.modulo(rightValue).toNumber();
      if (!Number.isFinite(result)) {
        throw new RuntimeError(`Invalid division by zero`);
      }
    } else if (ctx.ASSIGN()) {
      result = expressionValue;
    }
    assignable.setValue(result);
    return null;
  };

  visitAssignable = (ctx: AssignableContext): ArcscriptVariable => {
    return this.visitIdentifier(ctx.identifier());
  };

  visitExpression(ctx: ExpressionContext): VarValue {
    if (ctx.constructor === ComparisonExpressionContext) {
      return this.visitComparisonExpression(ctx);
    }
    if (ctx.constructor === UnaryExpressionContext) {
      return this.visitUnaryExpression(ctx);
    }
    if (ctx.constructor === MultiplicativeExpressionContext) {
      return this.visitMultiplicativeExpression(ctx);
    }
    if (ctx.constructor === AdditiveExpressionContext) {
      return this.visitAdditiveExpression(ctx);
    }
    if (ctx.constructor === ParenthesizedExpressionContext) {
      return this.visitParenthesizedExpression(ctx);
    }
    if (ctx.constructor === FunctionCallExpressionContext) {
      return this.visitFunctionCallExpression(ctx);
    }
    if (ctx.constructor === LiteralExpressionContext) {
      return this.visitLiteralExpression(ctx);
    }
    if (ctx.constructor === IdentifierExpressionContext) {
      return this.visitIdentifierExpression(ctx);
    }
    throw new RuntimeError(
      'Invalid expression: Constructor = ' + ctx.constructor.name
    );
  }

  visitComparisonExpression = (ctx: ComparisonExpressionContext): boolean => {
    const left = this.visitExpression(ctx.expression(0));
    if (ctx.AND() || ctx.ANDKEYWORD()) {
      if (!left) {
        return false;
      }
      const right = this.visitExpression(ctx.expression(1));
      return Boolean(left) && Boolean(right);
    }
    if (ctx.OR() || ctx.ORKEYWORD()) {
      if (left) {
        return true;
      }
      const right = this.visitExpression(ctx.expression(1));
      return Boolean(left) || Boolean(right);
    }
    const right = this.visitExpression(ctx.expression(1));

    if (ctx.EQ() || (ctx.ISKEYWORD() && !ctx.NOTKEYWORD())) {
      return left === right;
    }
    if (ctx.NE() || (ctx.ISKEYWORD() && ctx.NOTKEYWORD())) {
      return left !== right;
    }
    if (ctx.LT()) {
      return left < right;
    }
    if (ctx.GT()) {
      return left > right;
    }
    if (ctx.LE()) {
      return left <= right;
    }
    if (ctx.GE()) {
      return left >= right;
    }
    throw new RuntimeError('Invalid comparison operator');
  };

  visitUnaryExpression = (ctx: UnaryExpressionContext) => {
    if (ctx.NOTKEYWORD() || ctx.NEG()) {
      return !this.visitExpression(ctx.expression());
    }
    if (ctx.ADD()) {
      return this.visitExpression(ctx.expression());
    }
    if (ctx.SUB()) {
      return -this.visitExpression(ctx.expression());
    }
    throw new RuntimeError('Invalid unary operator');
  };

  visitMultiplicativeExpression = (ctx: MultiplicativeExpressionContext) => {
    const left = this.visitExpression(ctx.expression(0));
    const right = this.visitExpression(ctx.expression(1));
    if (typeof left === 'string' || typeof right === 'string') {
      throw new RuntimeError('Invalid operation with string');
    }
    const leftValue = new BigNumber(left as number);
    const rightValue = new BigNumber(right as number);

    if (ctx.MUL()) {
      return leftValue.multipliedBy(rightValue).toNumber();
    }
    if (ctx.DIV()) {
      if (rightValue.isZero()) {
        throw new RuntimeError('Invalid division by zero');
      }
      return leftValue.dividedBy(rightValue).toNumber();
    }
    if (ctx.MOD()) {
      if (rightValue.isZero()) {
        throw new RuntimeError('Invalid division by zero');
      }
      return leftValue.modulo(rightValue).toNumber();
    }
    throw new RuntimeError('Invalid multiplicative operator');
  };

  visitAdditiveExpression = (ctx: AdditiveExpressionContext) => {
    let left = this.visitExpression(ctx.expression(0));
    let right = this.visitExpression(ctx.expression(1));
    if (typeof left === 'string' || typeof right === 'string') {
      if (ctx.ADD()) {
        return (left as string) + (right as string);
      }
      throw new RuntimeError('Invalid operation with string');
    }
    left = Number(left);
    right = Number(right);

    const leftValue = new BigNumber(left as number);
    const rightValue = new BigNumber(right as number);

    if (ctx.ADD()) {
      return leftValue.plus(rightValue).toNumber();
    }
    if (ctx.SUB()) {
      return leftValue.minus(rightValue).toNumber();
    }
    throw new RuntimeError('Invalid additive operator');
  };

  visitParenthesizedExpression = (ctx: ParenthesizedExpressionContext) => {
    return this.visitExpression(ctx.expression());
  };

  visitIdentifierExpression = (ctx: IdentifierExpressionContext) => {
    const identifier = this.visitIdentifier(ctx.identifier());

    return identifier.getValue();
  };

  visitLiteralExpression = (ctx: LiteralExpressionContext) => {
    return this.visitLiteral(ctx.literal());
  };

  visitFunctionCallExpression = (ctx: FunctionCallExpressionContext) => {
    return this.visitFunction_call(ctx.function_call());
  };

  visitIdentifier = (ctx: IdentifierContext): ArcscriptVariable => {
    let name: string;
    let scope: string | null = null;
    if (ctx.IDENTIFIER_list().length === 1) {
      name = ctx.IDENTIFIER(0).getText();
    } else {
      scope = ctx.IDENTIFIER(0).getText();
      name = ctx.IDENTIFIER(1).getText();
    }
    const variableObject = this.state.getVar(name, scope);
    if (!variableObject) {
      throw new RuntimeError(`Variable ${name} not found`);
    }
    return variableObject;
  };

  visitLiteral = (ctx: LiteralContext) => {
    if (ctx.BOOLEAN()) {
      if (ctx.BOOLEAN().getText() === 'true') {
        return true;
      }
      return false;
    }
    if (ctx.STRING()) {
      let result = ctx.STRING().getText();
      result = result.replace(/^"(.*)"$/, '$1');
      return result;
    }
    return this.visitNumeric_literal(ctx.numeric_literal());
  };

  visitNumeric_literal = (ctx: Numeric_literalContext) => {
    if (ctx.FLOAT()) {
      return parseFloat(ctx.FLOAT().getText());
    }
    return parseInt(ctx.INTEGER().getText(), 10);
  };

  visitFunction_call = (ctx: Function_callContext) => {
    let argument_list: (VarValue | MentionResult | ArcscriptVariable)[] = [];
    const function_name = ctx.FNAME().getText() as ArcscriptNonVoidFunctionKeys;
    if (ctx.argument_list()) {
      argument_list = this.visitArgument_list(ctx.argument_list());
    }
    if (ctx.identifier_list()) {
      argument_list = this.visitIdentifier_list(ctx.identifier_list());
      if (
        ArcscriptParserBase.arcscriptFunctionsInfo[function_name].argType ===
        'variable'
      ) {
        argument_list = argument_list.map(variable => {
          if (variable instanceof ArcscriptVariable) {
            return variable;
          }
          throw new RuntimeError('Expected a variable');
        });
      } else {
        argument_list = argument_list.map(variable => {
          if (variable instanceof ArcscriptVariable) {
            return variable.getValue();
          }
          throw new RuntimeError('Expected a variable');
        });
      }
    }

    // TODO: remove non void function keys
    return this.functions[function_name](...argument_list);
  };

  visitIdentifier_list = (ctx: Identifier_listContext): ArcscriptVariable[] => {
    return ctx.identifier_list().map(identifier => {
      return this.visitIdentifier(identifier);
    });
  };

  visitArgument_list = (ctx: Argument_listContext) => {
    return ctx.argument_list().map(argument => this.visitArgument(argument));
  };

  visitArgument = (ctx: ArgumentContext): VarValue | MentionResult => {
    if (ctx.expression()) {
      return this.visitExpression(ctx.expression());
    }
    if (ctx.mention()) {
      return this.visitMention(ctx.mention());
    }

    throw new RuntimeError('Invalid argument');
  };

  visitMention = (ctx: MentionContext): MentionResult => {
    const attrs: Record<string, string | boolean> = {};

    ctx.mention_attributes_list().forEach(attr => {
      const { name, value } = this.visitMention_attributes(attr);
      attrs[name] = value;
    });
    let label = '';
    if (ctx.MENTION_LABEL()) {
      label = ctx.MENTION_LABEL().getText();
    }

    return {
      attrs,
      label,
    };
  };

  visitMention_attributes = (
    ctx: Mention_attributesContext
  ): { name: string; value: boolean | string } => {
    const name = ctx.ATTR_NAME().getText();
    const ctxvalue = ctx.ATTR_VALUE();
    let value: boolean | string = true;
    if (ctxvalue) {
      value = ctxvalue.getText();
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
    }

    return {
      name,
      value,
    };
  };
}
