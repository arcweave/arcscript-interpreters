/* eslint-disable camelcase */
import BigNumber from 'bignumber.js';
import ArcscriptParserVisitor from './Generated/ArcscriptParserVisitor.js';
import ArcscriptFunctions from './ArcscriptFunctions.js';
import ArcscriptState from './ArcscriptState.js';
import { RuntimeError } from './errors/index.js';

export default class ArcscriptVisitor extends ArcscriptParserVisitor {
  constructor(varValues, varObjects, elementVisits, currentElement, emit) {
    super();

    this.state = new ArcscriptState(
      varValues,
      varObjects,
      elementVisits,
      currentElement,
      emit
    );

    this.functions = new ArcscriptFunctions(this.state);
  }

  visitInput(ctx) {
    if (ctx.script()) {
      return { script: this.visitScript(ctx.script()) };
    }

    return {
      condition: this.visitCompound_condition_or(ctx.compound_condition_or()),
    };
  }

  visitScript_section(ctx) {
    if (!ctx) {
      return null;
    }
    if (Array.isArray(ctx.blockquote()) && ctx.blockquote().length > 0) {
      const result = ctx.blockquote().map(blockquoteContext => {
        return this.visitBlockquote(blockquoteContext);
      });
      return result;
    }

    if (Array.isArray(ctx.paragraph()) && ctx.paragraph().length > 0) {
      const result = ctx.paragraph().map(paragraphContext => {
        return this.visitParagraph(paragraphContext);
      });
      return result;
    }

    return this.visitChildren(ctx);
  }

  visitParagraph(ctx) {
    this.state.pushOutput(ctx.getText(), false);
    return ctx.getText();
  }

  visitBlockquote(ctx) {
    this.state.addBlockquoteStart();
    this.visitChildren(ctx);
    this.state.addBlockquoteEnd();

    return ctx.getText();
  }

  visitAssignment_segment(ctx) {
    this.state.addScript();
    return this.visitStatement_assignment(ctx.statement_assignment());
  }

  visitFunction_call_segment(ctx) {
    this.state.addScript();
    return this.visitStatement_function_call(ctx.statement_function_call());
  }

  visitConditional_section(ctx) {
    this.state.addScript();
    this.state.incrConditionDepth();
    const if_section = this.visitIf_section(ctx.if_section());
    if (if_section) {
      this.state.addScript();
      this.state.decrConditionDepth();
      return if_section;
    }
    const result = ctx.else_if_section().find(else_if_section => {
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
  }

  visitIf_section(ctx) {
    const result = this.visitIf_clause(ctx.if_clause());
    if (result) {
      return this.visitScript(ctx.script());
    }

    return null;
  }

  visitElse_if_section(ctx) {
    const result = this.visitElse_if_clause(ctx.else_if_clause());
    if (result) {
      return this.visitScript(ctx.script());
    }
    return null;
  }

  visitElse_section(ctx) {
    return this.visitScript(ctx.script());
  }

  visitIf_clause(ctx) {
    return this.visitCompound_condition_or(ctx.compound_condition_or());
  }

  visitElse_if_clause(ctx) {
    return this.visitCompound_condition_or(ctx.compound_condition_or());
  }

  visitStatement_assignment(ctx) {
    const variableName = ctx.VARIABLE().getText();
    const variableObject = this.state.getVar(variableName);

    let variableValue = this.state.getVarValue(variableObject.id);
    let compound_condition_or = this.visitCompound_condition_or(
      ctx.compound_condition_or()
    );
    let result = 0;
    if (
      typeof variableValue === 'string' ||
      typeof compound_condition_or === 'string'
    ) {
      if (ctx.ASSIGNADD()) {
        result = variableValue + compound_condition_or;
      } else if (ctx.ASSIGN()) {
        result = compound_condition_or;
      } else {
        throw new RuntimeError('Invalid operation with string');
      }
      this.state.setVarValues([variableObject.id], [result]);
      return null;
    }
    if (
      ctx.ASSIGNADD() ||
      ctx.ASSIGNSUB() ||
      ctx.ASSIGNMUL() ||
      ctx.ASSIGNDIV()
    ) {
      if (typeof variableValue === 'boolean') {
        variableValue = variableValue ? 1 : 0;
      }
      if (typeof compound_condition_or === 'boolean') {
        compound_condition_or = compound_condition_or ? 1 : 0;
      }
    }
    if (ctx.ASSIGNADD()) {
      result = new BigNumber(variableValue)
        .plus(new BigNumber(compound_condition_or))
        .toNumber();
    } else if (ctx.ASSIGNSUB()) {
      result = new BigNumber(variableValue)
        .minus(new BigNumber(compound_condition_or))
        .toNumber();
    } else if (ctx.ASSIGNMUL()) {
      result = new BigNumber(variableValue)
        .multipliedBy(new BigNumber(compound_condition_or))
        .toNumber();
    } else if (ctx.ASSIGNDIV()) {
      result = new BigNumber(variableValue)
        .dividedBy(new BigNumber(compound_condition_or))
        .toNumber();
      if (!Number.isFinite(result)) {
        throw new RuntimeError(`Invalid division by zero`);
      }
    } else if (ctx.ASSIGN()) {
      result = compound_condition_or;
    }
    this.state.setVarValues([variableObject.id], [result]);
    return null;
  }

  visitVoid_function_call(ctx) {
    let argument_list = [];
    let fname = '';
    if (ctx.VFNAME()) {
      fname = ctx.VFNAME().getText();
      if (ctx.argument_list()) {
        argument_list = this.visitArgument_list(ctx.argument_list());
      }
    }
    if (ctx.VFNAMEVARS()) {
      fname = ctx.VFNAMEVARS().getText();
      if (ctx.variable_list()) {
        argument_list = this.visitVariable_list(ctx.variable_list());
      }
    }

    return this.functions[fname](...argument_list);
  }

  visitVariable_list(ctx) {
    return ctx.VARIABLE().map(variable => variable.getText());
  }

  visitCompound_condition_or(ctx) {
    const compound_condition_and = this.visitCompound_condition_and(
      ctx.compound_condition_and()
    );

    if (ctx.compound_condition_or()) {
      return (
        compound_condition_and ||
        this.visitCompound_condition_or(ctx.compound_condition_or())
      );
    }

    return compound_condition_and;
  }

  visitCompound_condition_and(ctx) {
    const negated_unary_condition = this.visitNegated_unary_condition(
      ctx.negated_unary_condition()
    );

    if (ctx.compound_condition_and()) {
      return (
        negated_unary_condition &&
        this.visitCompound_condition_and(ctx.compound_condition_and())
      );
    }

    return negated_unary_condition;
  }

  visitNegated_unary_condition(ctx) {
    const unary_condition = this.visitUnary_condition(ctx.unary_condition());

    if (ctx.NEG() || ctx.NOTKEYWORD()) {
      return !unary_condition;
    }

    return unary_condition;
  }

  visitUnary_condition(ctx) {
    return this.visitCondition(ctx.condition());
  }

  visitCondition(ctx) {
    if (ctx.expression().length === 1) {
      return this.visitExpression(ctx.expression()[0]);
    }
    const conditional_operator = ctx.conditional_operator();
    const exp0 = this.visitExpression(ctx.expression()[0]);
    const exp1 = this.visitExpression(ctx.expression()[1]);

    if (conditional_operator.GT()) {
      return exp0 > exp1;
    }
    if (conditional_operator.GE()) {
      return exp0 >= exp1;
    }
    if (conditional_operator.LT()) {
      return exp0 < exp1;
    }
    if (conditional_operator.LE()) {
      return exp0 <= exp1;
    }
    if (conditional_operator.EQ()) {
      return exp0 === exp1;
    }
    if (conditional_operator.NE()) {
      return exp0 !== exp1;
    }
    if (conditional_operator.ISKEYWORD) {
      if (conditional_operator.NOTKEYWORD()) {
        return exp0 !== exp1;
      }
      return exp0 === exp1;
    }

    return this.visitChildren(ctx);
  }

  visitExpression(ctx) {
    if (ctx.STRING()) {
      let result = ctx.STRING().getText();
      result = result.replace(/^"(.*)"$/, '$1');
      return result;
    }
    if (ctx.BOOLEAN()) {
      if (ctx.BOOLEAN().getText() === 'true') {
        return true;
      }
      return false;
    }

    return this.visitAdditive_numeric_expression(
      ctx.additive_numeric_expression()
    );
  }

  visitAdditive_numeric_expression(ctx) {
    if (ctx.additive_numeric_expression()) {
      let additive_numeric_expression = this.visitAdditive_numeric_expression(
        ctx.additive_numeric_expression()
      );

      let multiplicative_numeric_expression =
        this.visitMultiplicative_numeric_expression(
          ctx.multiplicative_numeric_expression()
        );

      let hasString = typeof multiplicative_numeric_expression === 'string';

      hasString = hasString || typeof additive_numeric_expression === 'string';

      if (!hasString) {
        if (typeof multiplicative_numeric_expression === 'boolean') {
          multiplicative_numeric_expression = multiplicative_numeric_expression
            ? 1
            : 0;
        }
        if (typeof additive_numeric_expression === 'boolean') {
          additive_numeric_expression = additive_numeric_expression ? 1 : 0;
        }
      }

      if (ctx.ADD()) {
        if (hasString) {
          return (
            additive_numeric_expression + multiplicative_numeric_expression
          );
        }
        return new BigNumber(additive_numeric_expression)
          .plus(new BigNumber(multiplicative_numeric_expression))
          .toNumber();
      }
      if (hasString) {
        throw new RuntimeError('Invalid subtraction with string');
      }
      return new BigNumber(additive_numeric_expression)
        .minus(new BigNumber(multiplicative_numeric_expression))
        .toNumber();
    }

    const multiplicative_numeric_expression =
      this.visitMultiplicative_numeric_expression(
        ctx.multiplicative_numeric_expression()
      );

    return multiplicative_numeric_expression;
  }

  visitMultiplicative_numeric_expression(ctx) {
    if (ctx.multiplicative_numeric_expression()) {
      let multiplicative_numeric_expression =
        this.visitMultiplicative_numeric_expression(
          ctx.multiplicative_numeric_expression()
        );
      let signed_unary_numeric_expression =
        this.visitSigned_unary_numeric_expression(
          ctx.signed_unary_numeric_expression()
        );
      if (typeof signed_unary_numeric_expression === 'boolean') {
        signed_unary_numeric_expression = signed_unary_numeric_expression
          ? 1
          : 0;
      }
      if (typeof multiplicative_numeric_expression === 'boolean') {
        multiplicative_numeric_expression = multiplicative_numeric_expression
          ? 1
          : 0;
      }
      if (ctx.MUL()) {
        return new BigNumber(multiplicative_numeric_expression)
          .multipliedBy(new BigNumber(signed_unary_numeric_expression))
          .toNumber();
      }
      // else DIV
      const result = new BigNumber(multiplicative_numeric_expression)
        .dividedBy(new BigNumber(signed_unary_numeric_expression))
        .toNumber();
      if (!Number.isFinite(result)) {
        throw new RuntimeError(`Invalid division by zero`);
      }
      return result;
    }

    const signed_unary_numeric_expression =
      this.visitSigned_unary_numeric_expression(
        ctx.signed_unary_numeric_expression()
      );

    return signed_unary_numeric_expression;
  }

  visitSigned_unary_numeric_expression(ctx) {
    const unary_numeric_expression = this.visitUnary_numeric_expression(
      ctx.unary_numeric_expression()
    );

    const sign = ctx.sign();
    if (sign) {
      if (sign.ADD()) {
        return +unary_numeric_expression;
      }
      return -unary_numeric_expression;
    }
    return unary_numeric_expression;
  }

  visitUnary_numeric_expression(ctx) {
    if (ctx.FLOAT()) {
      return parseFloat(ctx.FLOAT().getText());
    }
    if (ctx.INTEGER()) {
      return parseInt(ctx.INTEGER().getText(), 10);
    }
    if (ctx.VARIABLE()) {
      const variableName = ctx.VARIABLE().getText();
      const variableObject = this.state.getVar(variableName);

      return this.state.getVarValue(variableObject.id);
    }
    if (ctx.STRING()) {
      let result = ctx.STRING().getText();
      result = result.replace(/^"(.*)"$/, '$1');
      return result;
    }
    if (ctx.BOOLEAN()) {
      if (ctx.BOOLEAN().getText() === 'true') {
        return true;
      }
      return false;
    }
    if (ctx.function_call()) {
      return this.visitFunction_call(ctx.function_call());
    }
    return this.visitCompound_condition_or(ctx.compound_condition_or());
  }

  visitFunction_call(ctx) {
    let argument_list = [];
    if (ctx.argument_list()) {
      argument_list = this.visitArgument_list(ctx.argument_list());
    }

    const function_name = ctx.FNAME().getText();
    return this.functions[function_name](...argument_list);
  }

  visitArgument_list(ctx) {
    return ctx.argument().map(argument => this.visitArgument(argument));
  }

  visitArgument(ctx) {
    if (ctx.STRING()) {
      let result = ctx.STRING().getText();
      result = result.replace(/^"(.*)"$/, '$1');
      return result;
    }
    if (ctx.mention()) {
      return this.visitMention(ctx.mention());
    }
    return this.visitAdditive_numeric_expression(
      ctx.additive_numeric_expression()
    );
  }

  visitMention(ctx) {
    const attrs = {};

    ctx.mention_attributes().forEach(attr => {
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
  }

  visitMention_attributes(ctx) {
    const name = ctx.ATTR_NAME().getText();
    const ctxvalue = ctx.ATTR_VALUE();
    let value = true;
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
  }
}
