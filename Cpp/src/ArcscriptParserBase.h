#pragma once

#include "antlr4-runtime.h"
#include "ArcscriptHelpers.h"

class ArcscriptParserBase : public antlr4::Parser {
private:
  Arcweave::ArcscriptState* _state;
  size_t openTagEndPos;
public:
  int currentLine = 0;
  ArcscriptParserBase(antlr4::TokenStream *input) : Parser(input) { }
  inline void setArcscriptState(Arcweave::ArcscriptState *state) { _state = state; };
  bool assertVariable(antlr4::ParserRuleContext *variable) const;
  bool assertMention(std::any attrCtxList);
  bool assertFunctionArguments(antlr4::Token *fname, std::any listContext);
  void setLineStart(antlr4::Token *token);
};
