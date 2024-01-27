import antlr4, { RecognitionException } from 'antlr4';
import { ParseError } from './errors/index.js';
import ArcscriptParser from './Generated/ArcscriptParser.js';
import ArcscriptLexer from './Generated/ArcscriptLexer.js';

export default class ErrorListener extends antlr4.error.ErrorListener {
  /**
   *
   * @param {antlr4.Recognizer} recognizer
   * @param {} offendingSymbol
   * @param {number} line
   * @param {number} column
   * @param {string} msg
   * @param {RecognitionException} e
   */
  syntaxError(recognizer, offendingSymbol, line, column, msg, e) {
    const col = column - recognizer.openTagEndPos;
    if (e?.ctx?.ruleContext instanceof ArcscriptParser.BlockquoteContext) {
      if (
        offendingSymbol.type === ArcscriptLexer.IFKEYWORD &&
        e.input.tokens[offendingSymbol.tokenIndex - 1].type ===
          ArcscriptLexer.BQ_CODESTART
      ) {
        msg = 'Conditional code blocks are not supported inside blockquotes';
      }
    }
    throw new ParseError(msg, { line: recognizer.currentLine, col });
  }

  reportAmbiguity(
    recognizer,
    dfa,
    startIndex,
    stopIndex,
    exact,
    ambigAlts,
    configs
  ) {}

  reportAttemptingFullContext(
    recognizer,
    dfa,
    startIndex,
    stopIndex,
    conflictingAlts,
    configs
  ) {}

  reportContextSensitivity(
    recognizer,
    dfa,
    startIndex,
    stopIndex,
    prediction,
    configs
  ) {}
}
