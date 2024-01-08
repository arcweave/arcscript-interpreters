import antlr4 from 'antlr4';
import { ParseError } from './errors/index.js';

export default class ErrorListener extends antlr4.error.ErrorListener {
  syntaxError(recognizer, offendingSymbol, line, column, msg, e) {
    const col = column - recognizer.openTagEndPos;

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
