#pragma once

#include "antlr4-runtime.h"
#include "ArcscriptContext.h"

class ArcscriptParserBase : public antlr4::Parser {
private:
  Arcweave::ArcscriptState* _state;
  const Arcweave::ArcscriptContext* _declarations;
  size_t openTagEndPos;
public:
  int currentLine = 0;
  ArcscriptParserBase(antlr4::TokenStream *input) : Parser(input) { }
  inline void setArcscriptState(Arcweave::ArcscriptState *state, const Arcweave::ArcscriptContext& declarations) {
    _state = state;
    _declarations = &declarations;
  };
  bool assertVariable(antlr4::ParserRuleContext *variable) const;
  bool assertMention(std::any attrCtxList);
  bool assertFunctionArguments(antlr4::Token *fname, std::any listContext);
  void setLineStart(antlr4::Token *token);
};
