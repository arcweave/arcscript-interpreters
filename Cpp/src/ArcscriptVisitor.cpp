#include "antlr4-runtime.h"
#include "ArcscriptVisitor.h"
#include "ArcscriptParser.h"
#include "ArcscriptExpression.h"
#include "ArcscriptErrorExceptions.h"

using namespace Arcweave;

std::any ArcscriptVisitor::visitInput(ArcscriptParser::InputContext * ctx)
{
  if (ctx->script() != nullptr) {
    return visitScript(ctx->script());
  }
  // Condition
  auto comp_cond = std::any_cast<Expression>(visitCondition(ctx->condition()));
  return comp_cond.isTruthy();
}

std::any ArcscriptVisitor::visitCondition(ArcscriptParser::ConditionContext * ctx) {
  return visit(ctx->expression());
}

std::any ArcscriptVisitor::visitScript_section(ArcscriptParser::Script_sectionContext *ctx) {
  if (ctx == nullptr) {
    return {};
  }

  if (const auto blockquote_contexts = ctx->blockquote(); !blockquote_contexts.empty())
  {
    std::vector<std::any> result;
    for (const auto blockquote_context : blockquote_contexts)
    {
      result.push_back(visitBlockquote(blockquote_context));
    }
    return result;
  }

  if (const auto paragraph_contexts = ctx->paragraph(); !paragraph_contexts.empty())
  {
    std::vector<std::any> result;
    for (const auto paragraph_context : paragraph_contexts)
    {
      result.push_back(visitParagraph(paragraph_context));
    }
    return result;
  }

  return visitChildren(ctx);
}

std::any ArcscriptVisitor::visitBlockquote(ArcscriptParser::BlockquoteContext* context)
{
  state->outputs.AddBlockquote();
  visitChildren(context);
  state->outputs.ExitBlockquote();
  return context->getText();
}

std::any ArcscriptVisitor::visitParagraph(ArcscriptParser::ParagraphContext* context)
{
  const auto paragraph_end = context->PARAGRAPHEND()->getText();
  const auto paragraph_content = paragraph_end.substr(0, paragraph_end.size() - 4); // size of "</p>"
  state->outputs.AddParagraph(paragraph_content);
  return context->getText();
}


std::any ArcscriptVisitor::visitAssignment_segment(ArcscriptParser::Assignment_segmentContext *ctx) {
  state->outputs.AddScript();
  return visitStatement_assignment(ctx->statement_assignment());
}

std::any ArcscriptVisitor::visitFunction_call_segment(ArcscriptParser::Function_call_segmentContext *ctx) {
  state->outputs.AddScript();
  return visitFunction_call(ctx->function_call());
}

std::any ArcscriptVisitor::visitConditional_section(ArcscriptParser::Conditional_sectionContext *ctx) {
  state->outputs.AddScript();
  auto ifSection = std::any_cast<ConditionalSection>(visitIf_section(ctx->if_section()));
  if (ifSection.clause) {
    state->outputs.AddScript();
    return ifSection.script;
  }
  for (ArcscriptParser::Else_if_sectionContext *else_if_section : ctx->else_if_section()) {
    auto elif_section = std::any_cast<ConditionalSection>(visitElse_if_section(else_if_section));
    if (elif_section.clause) {
      return elif_section.script;
    }
  }
  if (ctx->else_section() != nullptr) {
    const auto elseSection = std::any_cast<ConditionalSection>(visitElse_section(ctx->else_section()));
    state->outputs.AddScript();
    return elseSection.script;
  }
  state->outputs.AddScript();
  return {};
}

std::any ArcscriptVisitor::visitIf_section(ArcscriptParser::If_sectionContext *ctx) {
  const auto result = std::any_cast<Expression>(visitIf_clause(ctx->if_clause()));
  ConditionalSection ifSection;
  ifSection.clause = false;
  if (result == true) {
    ifSection.clause = true;
    ifSection.script = visitScript(ctx->script());
  }
  return ifSection;
}

std::any ArcscriptVisitor::visitElse_if_section(ArcscriptParser::Else_if_sectionContext *ctx) {
  const auto result = std::any_cast<Expression>(visitElse_if_clause(ctx->else_if_clause()));
  ConditionalSection elseSection;
  elseSection.clause = false;
  if (result == true) {
    elseSection.clause = true;
    elseSection.script = visitScript(ctx->script());
  }

  return elseSection;
}

std::any ArcscriptVisitor::visitElse_section(ArcscriptParser::Else_sectionContext *ctx) {
  ConditionalSection elseIfSection;
  elseIfSection.clause = true;
  elseIfSection.script = visitScript(ctx->script());
  return elseIfSection;
}

std::any ArcscriptVisitor::visitIf_clause(ArcscriptParser::If_clauseContext *ctx) {
  return visit(ctx->expression());
}

std::any ArcscriptVisitor::visitElse_if_clause(ArcscriptParser::Else_if_clauseContext *ctx) {
  return visit(ctx->expression());
}

std::any ArcscriptVisitor::visitStatement_assignment(ArcscriptParser::Statement_assignmentContext *ctx) {
  auto identifier = std::any_cast<IdentifierDef>(visitAssignable(ctx->assignable()));
  auto identifierExpr = Expression();
  identifierExpr.setValue(state->getVarValue(identifier));

  auto re = std::any_cast<Expression>(visit(ctx->expression()));

  if (ctx->ASSIGN() != nullptr) {
    state->setVarValue(identifier, re.value);
    return {};
  }

  Expression varValue;
  varValue.setValue(state->getVarValue(identifier));

  if (ctx->ASSIGNADD() != nullptr) {
    varValue += re;
  } else if (ctx->ASSIGNSUB() != nullptr) {
    varValue -= re;
  } else if (ctx->ASSIGNMUL() != nullptr) {
    varValue *= re;
  } else if (ctx->ASSIGNDIV() != nullptr) {
    varValue /= re;
  } else if (ctx->ASSIGNMOD() != nullptr) {
    varValue %= re;
  }

  state->setVarValue(identifier, varValue.value);
  return {};
}

std::any ArcscriptVisitor::visitAssignable(ArcscriptParser::AssignableContext *ctx) {
  return visitIdentifier(ctx->identifier());
}

std::any ArcscriptVisitor::visitComparisonExpression(ArcscriptParser::ComparisonExpressionContext *ctx) {
  auto left = std::any_cast<Expression>(visit(ctx->expression(0)));
  if (ctx->AND() != nullptr || ctx->ANDKEYWORD() != nullptr) {
    if (!left.isTruthy()) {
      return Expression(false);
    }
    auto right = std::any_cast<Expression>(visit(ctx->expression(1)));
    return Expression(right.isTruthy());
  }

  if (ctx->OR() != nullptr || ctx->ORKEYWORD() != nullptr) {
    if (left.isTruthy()) {
      return Expression(true);
    }
    auto right = std::any_cast<Expression>(visit(ctx->expression(1)));
    return right;
  }

  auto right = std::any_cast<Expression>(visit(ctx->expression(1)));

  if (ctx->EQ() != nullptr || (ctx->ISKEYWORD() != nullptr && ctx->NOTKEYWORD() == nullptr)) {
    return Expression(left == right);
  }

  if (ctx->NE() != nullptr || (ctx->ISKEYWORD() != nullptr && ctx->NOTKEYWORD() != nullptr)) {
    return Expression(left != right);
  }

  if (ctx->LT() != nullptr) {
    return Expression(left < right);
  }

  if (ctx->GT() != nullptr) {
    return Expression(left > right);
  }

  if (ctx->LE() != nullptr) {
    return Expression(left <= right);
  }

  if (ctx->GE() != nullptr) {
    return Expression(left >= right);
  }

  throw RuntimeErrorException("Invalid comparison operator");
}

std::any ArcscriptVisitor::visitUnaryExpression(ArcscriptParser::UnaryExpressionContext *ctx) {
  if (ctx->NOTKEYWORD() != nullptr || ctx->NEG() != nullptr) {
    auto operand = std::any_cast<Expression>(visit(ctx->expression()));
    return Expression(!operand);
  }
  if (ctx->ADD() != nullptr) {
    return visit(ctx->expression());
  }
  if (ctx->SUB() != nullptr) {
    auto operand = std::any_cast<Expression>(visit(ctx->expression()));
    return -operand;
  }
  throw RuntimeErrorException("Invalid unary operator");
}

std::any ArcscriptVisitor::visitMultiplicativeExpression(ArcscriptParser::MultiplicativeExpressionContext *ctx) {
  auto left = std::any_cast<Expression>(visit(ctx->expression(0)));
  auto right = std::any_cast<Expression>(visit(ctx->expression(1)));
  if (ctx->MUL() != nullptr) {
    return left * right;
  }
  if (ctx->DIV() != nullptr) {
    return left / right;
  }
  if (ctx->MOD() != nullptr) {
    return left % right;
  }
  throw RuntimeErrorException("Invalid multiplicative operator");
}

std::any ArcscriptVisitor::visitAdditiveExpression(ArcscriptParser::AdditiveExpressionContext *ctx) {
  auto left = std::any_cast<Expression>(visit(ctx->expression(0)));
  auto right = std::any_cast<Expression>(visit(ctx->expression(1)));
  if (ctx->ADD() != nullptr) {
    return left + right;
  }
  if (ctx->SUB() != nullptr) {
    return left - right;
  }
  throw RuntimeErrorException("Invalid additive operator");
}

std::any ArcscriptVisitor::visitParenthesizedExpression(ArcscriptParser::ParenthesizedExpressionContext *ctx) {
  return visit(ctx->expression());
}

std::any ArcscriptVisitor::visitIdentifierExpression(ArcscriptParser::IdentifierExpressionContext *ctx) {
  auto idDef = std::any_cast<IdentifierDef>(visitIdentifier(ctx->identifier()));
  auto result = Expression();
  result.setValue(state->getVarValue(idDef));
  return result;
}

std::any ArcscriptVisitor::visitLiteralExpression(ArcscriptParser::LiteralExpressionContext *ctx) {
  return visitLiteral(ctx->literal());
}

std::any ArcscriptVisitor::visitFunctionCallExpression(ArcscriptParser::FunctionCallExpressionContext *ctx) {
  auto result = visitFunction_call(ctx->function_call());
  Expression e;
  e.setValue(result);
  return e;
}

std::any ArcscriptVisitor::visitLiteral(ArcscriptParser::LiteralContext *ctx) {
  if (ctx->STRING() != nullptr) {
    std::string result = ctx->STRING()->getText();
    result = result.substr(1, result.size() - 2);
    return Expression(result);
  }
  if (ctx->BOOLEAN() != nullptr) {
    return Expression(ctx->BOOLEAN()->getText() == "true");
  }
  return visitNumeric_literal(ctx->numeric_literal());
}

std::any ArcscriptVisitor::visitNumeric_literal(ArcscriptParser::Numeric_literalContext *ctx) {
  if (ctx->FLOAT() != nullptr) {
    return Expression(std::stod(ctx->FLOAT()->getText()));
  }
  return Expression(std::stoi(ctx->INTEGER()->getText()));;
}

std::any ArcscriptVisitor::visitFunction_call(ArcscriptParser::Function_callContext *ctx) {
  std::vector<std::any> argument_list_result;
  std::string fname = ctx->FNAME()->getText();

  if (ctx->argument_list() != nullptr) {
    argument_list_result = std::any_cast<std::vector<std::any>>(visitArgument_list(ctx->argument_list()));
  }

  if (ctx->identifier_list() != nullptr) {
    auto identifierList = std::any_cast<std::vector<IdentifierDef>>(visitIdentifier_list(ctx->identifier_list()));
    if (ArcscriptFunctions::functions[fname].argsType == "variable") {
      for (size_t i = 0; i < identifierList.size(); i++) {
        argument_list_result.push_back(state->getVar(identifierList[i]));
      }
    } else {
      for (size_t i = 0; i < identifierList.size(); i++) {
        auto e = Expression();
        e.setValue(state->getVarValue(identifierList[i]));
        argument_list_result.push_back(e);
      }
    }
  }

  std::any result = functions->Call(fname, argument_list_result);
  return result;
}

std::any ArcscriptVisitor::visitArgument_list(ArcscriptParser::Argument_listContext *ctx) {
  std::vector<std::any> arguments;
  for (ArcscriptParser::ArgumentContext *argument : ctx->argument()) {
    arguments.push_back(visitArgument(argument));
  }
  return arguments;
}

std::any ArcscriptVisitor::visitArgument(ArcscriptParser::ArgumentContext *ctx) {
  if (ctx->expression() != nullptr) {
    return visit(ctx->expression());
  }
  if (ctx->mention() != nullptr) {
    auto mention_result = std::any_cast<Mention>(visitMention(ctx->mention()));
    return mention_result;
  }

  throw RuntimeErrorException("Invalid function argument");
}

std::any ArcscriptVisitor::visitIdentifier_list(ArcscriptParser::Identifier_listContext *ctx) {
  std::vector<IdentifierDef> identifiers;
  for (auto *id : ctx->identifier()) {
    identifiers.push_back(std::any_cast<IdentifierDef>(visitIdentifier(id)));
  }
  return identifiers;
}

std::any ArcscriptVisitor::visitIdentifier(ArcscriptParser::IdentifierContext *ctx) {
  std::string name;
  std::string scope;
  if (ctx->IDENTIFIER().size() == 1) {
    name = ctx->IDENTIFIER(0)->getText();
  } else {
    scope = ctx->IDENTIFIER(0)->getText();
    name = ctx->IDENTIFIER(1)->getText();
  }
  IdentifierDef def;
  def.name = name;
  def.scope = scope;
  return def;
}

std::any ArcscriptVisitor::visitMention(ArcscriptParser::MentionContext *ctx) {
  std::map<std::string, std::string> attrs;
  for (ArcscriptParser::Mention_attributesContext *attr : ctx->mention_attributes()) {
    auto res = std::any_cast<std::map<std::string, std::string>>(visitMention_attributes(attr));
    attrs[res["name"]] = res["value"];
  }
  std::string label;
  if (ctx->MENTION_LABEL() != nullptr) {
    label = ctx->MENTION_LABEL()->getText();
  }
  Mention mention(label, attrs);
  return mention;
}

inline bool ends_with(std::string const & value, std::string const & ending)
{
    if (ending.size() > value.size()) return false;
    return std::equal(ending.rbegin(), ending.rend(), value.rbegin());
}

std::any ArcscriptVisitor::visitMention_attributes(ArcscriptParser::Mention_attributesContext *ctx) {
  std::string name = ctx->ATTR_NAME()->getText();
  antlr4::tree::TerminalNode *valueNode = ctx->ATTR_VALUE();
  std::string value(name);
  
  if (valueNode != nullptr) {
    std::string strvalue = valueNode->getText();
    if ((strvalue.rfind('\"', 0) == 0 && ends_with(strvalue, "\"")) ||
         (strvalue.rfind('\'', 0) == 0 && ends_with(strvalue, "'"))) {
      
      strvalue = strvalue.substr(1, strvalue.size() - 2);
      
    }
    value = strvalue;
  }
  return std::map<std::string, std::string> { {"name", name }, {"value", value } };
}
