#pragma once

#include "ArcscriptParserBaseVisitor.h"
#include "ArcscriptFunctions.h"

using namespace Arcweave;

class ArcscriptVisitor : public ArcscriptParserBaseVisitor {
public:
  struct ConditionalSection {
    bool clause;
    std::any script;
  };

  ArcscriptState *state;
  ArcscriptFunctions *functions;

  explicit ArcscriptVisitor(ArcscriptState* _state) : state(_state) {
    functions = new ArcscriptFunctions(state);
  }
  ~ArcscriptVisitor() override {
    delete functions;
  }

  std::any visitInput(ArcscriptParser::InputContext *ctx) override;
  std::any visitScript_section(ArcscriptParser::Script_sectionContext *ctx) override;
  std::any visitCondition(ArcscriptParser::ConditionContext *ctx) override;
  std::any visitParagraph(ArcscriptParser::ParagraphContext* context) override;
  std::any visitBlockquote(ArcscriptParser::BlockquoteContext* context) override;
  std::any visitAssignment_segment(ArcscriptParser::Assignment_segmentContext *ctx) override;
  std::any visitFunction_call_segment(ArcscriptParser::Function_call_segmentContext * ctx) override;
  std::any visitConditional_section(ArcscriptParser::Conditional_sectionContext *ctx) override;
  std::any visitIf_section(ArcscriptParser::If_sectionContext *ctx) override;
  std::any visitElse_if_section(ArcscriptParser::Else_if_sectionContext *ctx) override;
  std::any visitElse_section(ArcscriptParser::Else_sectionContext *ctx) override;
  std::any visitIf_clause(ArcscriptParser::If_clauseContext *ctx) override;
  std::any visitElse_if_clause(ArcscriptParser::Else_if_clauseContext *ctx) override;
  std::any visitStatement_assignment(ArcscriptParser::Statement_assignmentContext *ctx) override;
  std::any visitAssignable(ArcscriptParser::AssignableContext *context) override;
  std::any visitIdentifier(ArcscriptParser::IdentifierContext *context) override;
  std::any visitComparisonExpression(ArcscriptParser::ComparisonExpressionContext *context) override;
  std::any visitUnaryExpression(ArcscriptParser::UnaryExpressionContext *context) override;
  std::any visitMultiplicativeExpression(ArcscriptParser::MultiplicativeExpressionContext *ctx) override;
  std::any visitAdditiveExpression(ArcscriptParser::AdditiveExpressionContext *context) override;
  std::any visitParenthesizedExpression(ArcscriptParser::ParenthesizedExpressionContext *context) override;
  std::any visitIdentifierExpression(ArcscriptParser::IdentifierExpressionContext *context) override;
  std::any visitLiteralExpression(ArcscriptParser::LiteralExpressionContext *context) override;
  std::any visitFunctionCallExpression(ArcscriptParser::FunctionCallExpressionContext *context) override;
  std::any visitLiteral(ArcscriptParser::LiteralContext *context) override;
  std::any visitNumeric_literal(ArcscriptParser::Numeric_literalContext *context) override;
  std::any visitFunction_call(ArcscriptParser::Function_callContext *ctx) override;
  std::any visitArgument_list(ArcscriptParser::Argument_listContext *ctx) override;
  std::any visitArgument(ArcscriptParser::ArgumentContext *ctx) override;
  std::any visitIdentifier_list(ArcscriptParser::Identifier_listContext *context) override;
  std::any visitMention(ArcscriptParser::MentionContext *ctx) override;
  std::any visitMention_attributes(ArcscriptParser::Mention_attributesContext *ctx) override;
};
