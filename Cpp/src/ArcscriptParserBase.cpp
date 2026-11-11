#include "ArcscriptParser.h"
#include "ArcscriptLexer.h"
#include "ArcscriptParserBase.h"
#include "ArcscriptExpression.h"
#include "ArcscriptErrorExceptions.h"
#include "ArcscriptFunctions.h"

using namespace antlr4;

Arcweave::ParseErrorException ArcscriptParserBase::error(const std::string& message, ParserRuleContext* context) const {
  auto token = context->getStart();
  auto start = token->getStartIndex();
  size_t column = 0;
  if (start > openTagEndPos) {
    auto prefix = token->getInputStream()->getText(misc::Interval(openTagEndPos, start - 1));
    // Count UTF-16 units in ANTLR's UTF-8 text to match editor offsets.
    for (unsigned char byte : prefix) {
      if ((byte & 0xc0) != 0x80) ++column;
      if (byte >= 0xf0) ++column;
    }
  }
  return Arcweave::ParseErrorException(message, currentLine, column);
}

bool ArcscriptParserBase::assertVariable(antlr4::ParserRuleContext *identifierContext) const {
  std::string variableName = identifierContext->getText();
  if (_declarations->resolve(variableName)) {
    return true;
  }
  throw error("Unknown variable \"" + variableName + "\"", identifierContext);
}

void ArcscriptParserBase::assertAssignable(ParserRuleContext *identifier) const {
  auto reference = _declarations->resolve(identifier->getText());
  if (reference && reference->kind == Arcweave::ReferenceKind::EnumMember)
    throw error("Enum member " + identifier->getText() + " is read-only", identifier);
  assertVariable(identifier);
}

namespace {
using Arcweave::ArcscriptParser;
std::string expressionEnum(ArcscriptParser::ExpressionContext *context, const Arcweave::ArcscriptContext& declarations) {
  if (auto parenthesized = dynamic_cast<ArcscriptParser::ParenthesizedExpressionContext*>(context))
    return expressionEnum(parenthesized->expression(), declarations);
  if (auto identifier = dynamic_cast<ArcscriptParser::IdentifierExpressionContext*>(context)) {
    auto reference = declarations.resolve(identifier->identifier()->getText());
    return reference ? reference->enumId : "";
  }
  return "";
}
bool isConstantExpression(ArcscriptParser::ExpressionContext *context, const Arcweave::ArcscriptContext& declarations) {
  if (auto identifier = dynamic_cast<ArcscriptParser::IdentifierExpressionContext*>(context)) {
    auto reference = declarations.resolve(identifier->identifier()->getText());
    return reference && reference->kind == Arcweave::ReferenceKind::EnumMember;
  }
  if (dynamic_cast<ArcscriptParser::LiteralExpressionContext*>(context)) return true;
  if (auto function = dynamic_cast<ArcscriptParser::FunctionCallExpressionContext*>(context)) {
    auto call = function->function_call();
    if (!Arcweave::ArcscriptFunctions::functions.at(call->FNAME()->getText()).isPure) return false;
    if (call->identifier_list()) {
      for (auto identifier : call->identifier_list()->identifier()) {
        auto reference = declarations.resolve(identifier->getText());
        if (!reference || reference->kind != Arcweave::ReferenceKind::EnumMember) return false;
      }
    } else if (auto arguments = call->argument_list()) {
      for (auto argument : arguments->argument())
        if (!argument->expression() || !isConstantExpression(argument->expression(), declarations)) return false;
    }
    return true;
  }
  for (auto child : context->getRuleContexts<ArcscriptParser::ExpressionContext>())
    if (!isConstantExpression(child, declarations)) return false;
  return true;
}
}

void ArcscriptParserBase::validateEnums(ParserRuleContext *context) const {
  const auto& declarations = *_declarations;
  if (!declarations.hasEnums()) return;
  if (auto assignment = dynamic_cast<Arcweave::ArcscriptParser::Statement_assignmentContext*>(context)) {
    auto variable = declarations.resolve(assignment->assignable()->getText());
    if (variable && !variable->enumId.empty() && (!assignment->ASSIGN() ||
        expressionEnum(assignment->expression(), declarations) != variable->enumId))
      throw error("Enum assignment requires a member or variable of the same enum", context);
  }
  if (auto comparison = dynamic_cast<Arcweave::ArcscriptParser::ComparisonExpressionContext*>(context)) {
    if (comparison->AND() || comparison->ANDKEYWORD() || comparison->OR() || comparison->ORKEYWORD()) return;
    auto left = expressionEnum(comparison->expression(0), declarations);
    auto right = expressionEnum(comparison->expression(1), declarations);
    if (!left.empty() && !right.empty() && left != right)
      throw error("Cannot compare different enum types", context);
    if ((!left.empty() && right.empty() && isConstantExpression(comparison->expression(1), declarations)) ||
        (!right.empty() && left.empty() && isConstantExpression(comparison->expression(0), declarations)))
      throw error("Enum comparisons with constants require a named member", context);
    auto id = left.empty() ? right : left;
    if (!id.empty() && (comparison->LT() || comparison->GT() || comparison->LE() || comparison->GE()) &&
        declarations.enumType(id) != Arcweave::AW_INTEGER)
      throw error("Only integer enums support ordering", context);
  }
}

inline bool ends_with(std::string const & value, std::string const & ending)
{
    if (ending.size() > value.size()) return false;
    return std::equal(ending.rbegin(), ending.rend(), value.rbegin());
}

bool ArcscriptParserBase::assertMention(std::any attrCtxList) {
  std::map<std::string, std::string> attrs;
  ParserRuleContext *ctx = this->getContext();
  std::vector<Arcweave::ArcscriptParser::Mention_attributesContext *> ctxList = ctx->getRuleContexts<Arcweave::ArcscriptParser::Mention_attributesContext>();
  for (auto attrCtx : ctxList) {
    tree::TerminalNode *nameNode = attrCtx->getToken(Arcweave::ArcscriptParser::ATTR_NAME, 0);
    std::string attrName = "";
    if (nameNode) {
      attrName = nameNode->getText();
    }
    tree::TerminalNode *valueNode = attrCtx->getToken(Arcweave::ArcscriptParser::ATTR_VALUE, 0);
    std::string attrValue = "";
    if (nameNode) {
      attrValue = valueNode->getText();
    }

    if ((attrValue.rfind("\"", 0) == 0 && ends_with(attrValue, "\"")) ||
         (attrValue.rfind("'", 0) == 0 && ends_with(attrValue, "'"))) {
      
      attrValue = attrValue.substr(1, attrValue.size() - 2);
      
    }
    attrs[attrName] = attrValue;
  }
  std::stringstream classList(attrs["class"]);
  std::string className;
  bool classFound = false;
  while(classList >> className){
    if (className == "mention") {
      classFound = true;
      break;
    }
  }
  if (!classFound) {
    throw Arcweave::ParseErrorException("Invalid mention type");
  }
  if (attrs["data-type"] != "element") {
    throw Arcweave::ParseErrorException("Invalid mention type");
  }
  if (_state->visits.count(attrs["data-id"]) == 0) {
    throw Arcweave::ParseErrorException("Invalid element mention");
  }

  return true;
}

bool ArcscriptParserBase::assertFunctionArguments(Token *fname, std::any listContext) {
  int argListLength = 0;
  std::string functionName = fname->getText();
  int min = Arcweave::ArcscriptFunctions::functions[functionName].minArgs;
  int max = Arcweave::ArcscriptFunctions::functions[functionName].maxArgs;
  std::string argsType = Arcweave::ArcscriptFunctions::functions[functionName].argsType;
  if (listContext.type() == typeid(Arcweave::ArcscriptParser::Argument_listContext*)) {
    auto *argumentListCtx = std::any_cast<Arcweave::ArcscriptParser::Argument_listContext*>(listContext);
    if (argumentListCtx != NULL) {
      argListLength = static_cast<int>(argumentListCtx->argument().size());
    }
  }
  if (listContext.type() == typeid(Arcweave::ArcscriptParser::Identifier_listContext*)) {
    auto *variableListCtx = std::any_cast<Arcweave::ArcscriptParser::Identifier_listContext*>(listContext);
    if (variableListCtx != NULL) {
      argListLength = static_cast<int>(variableListCtx->identifier().size());
      if (argsType == "variable")
        for (auto identifier : variableListCtx->identifier()) assertAssignable(identifier);
    }
  }

  if (argsType == "variable" && listContext.type() == typeid(Arcweave::ArcscriptParser::Argument_listContext*)) {
    throw Arcweave::ParseErrorException("Invalid arguments type");
  }

  if ((min != -1 && argListLength < min) || (max != -1 && argListLength > max)) {
    throw Arcweave::ParseErrorException("Wrong number of arguments in \""+ functionName + "\".");
  }
  
  return true;
}

void ArcscriptParserBase::setLineStart(antlr4::Token* token)
{
  openTagEndPos = token->getStopIndex() + 1;
}
