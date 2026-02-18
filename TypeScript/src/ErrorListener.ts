import {
  RecognitionException,
  ErrorListener as BaseErrorListener,
  Recognizer,
  Token,
} from 'antlr4';
import { ParseError } from './errors/index.js';
import ArcscriptParser, {
  BlockquoteContext,
} from './Generated/ArcscriptParser.js';
import ArcscriptLexer from './Generated/ArcscriptLexer.js';

export default class ErrorListener<T> extends BaseErrorListener<T> {
  syntaxError(
    recognizer: Recognizer<T>,
    offendingSymbol: T,
    line: number,
    column: number,
    msg: string,
    e: RecognitionException | undefined
  ): void {
    if (recognizer instanceof ArcscriptParser) {
      column = column - recognizer.openTagEndPos;
      line = recognizer.currentLine;
    }

    if (recognizer instanceof ArcscriptParser) {
      if (e?.ctx.ruleContext instanceof BlockquoteContext) {
        if (
          offendingSymbol instanceof Token &&
          offendingSymbol.type === ArcscriptLexer.IFKEYWORD &&
          recognizer.getTokenStream().get(offendingSymbol.tokenIndex - 1)
            ?.type === ArcscriptLexer.BQ_CODESTART
        ) {
          msg = 'Conditional code blocks are not supported inside blockquotes';
        }
      }
    }
    throw new ParseError(msg, { line, col: column });
  }
}
