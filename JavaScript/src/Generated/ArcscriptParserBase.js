import antlr4 from 'antlr4';
// eslint-disable-next-line import/no-cycle
import ArcscriptParser from './ArcscriptParser.js';

export default class ArcscriptParserBase extends antlr4.Parser {
  static arcscriptFunctionsArgLength = {
    abs: [1, 1],
    max: [2, null],
    min: [2, null],
    random: [0, 0],
    roll: [1, 2],
    round: [1, 1],
    sqr: [1, 1],
    sqrt: [1, 1],
    visits: [0, 1],
    show: [1, null],
    reset: [1, null],
    resetAll: [0, null],
    resetVisits: [0, 0],
  };

  constructor(input) {
    super(input.input);

    this.varObjects = input.varObjects;
    this.elementVisits = input.elementVisits;
    this.currentElement = input.currentElement;

    // For error location recognition
    this.currentLine = 0;
    this.openTagEndPos = 0;

    this.arcscriptFunctionsArgLength =
      ArcscriptParserBase.arcscriptFunctionsArgLength;
  }

  setLineStart(token) {
    this.openTagEndPos = token.start + token.text.length;
  }

  assertFunctionArguments(token, argListCtx = null) {
    let argListLength = 0;

    if (argListCtx) {
      if (argListCtx instanceof ArcscriptParser.Argument_listContext) {
        argListLength = argListCtx.argument().length;
      } else if (argListCtx instanceof ArcscriptParser.Variable_listContext) {
        argListLength = argListCtx.VARIABLE().length;
      }
    }
    const min = this.arcscriptFunctionsArgLength[token.text][0];
    const max = this.arcscriptFunctionsArgLength[token.text][1];

    if (
      (min !== null && argListLength < min) ||
      (max !== null && argListLength > max)
    ) {
      this.notifyErrorListeners(
        `Invalid number of arguments for function ${token.text}`,
        token
      );
    }
  }

  assertVariable(variableToken) {
    const variableName = variableToken.text;
    if (
      !Object.values(this.varObjects).find(
        variable => variable.name === variableName
      )
    ) {
      this.notifyErrorListeners(
        `The variable ${variableName} does not exist`,
        variableToken
      );
    }
  }

  assertMention(attrListCtx) {
    const attrs = {};
    attrListCtx.forEach(ctx => {
      const attrName = ctx.getToken(ArcscriptParser.ATTR_NAME, 0).getText();
      let attrValue =
        ctx.getToken(ArcscriptParser.ATTR_VALUE, 0)?.getText() ?? '';
      if (attrValue.startsWith('"') && attrValue.endsWith('"')) {
        attrValue = attrValue.slice(1, -1);
      } else if (attrValue.startsWith("'") && attrValue.endsWith("'")) {
        attrValue = attrValue.slice(1, -1);
      }
      attrs[attrName] = attrValue;
    });
    const classList = attrs.class.split(' ');
    if (!classList.includes('mention')) {
      this.notifyErrorListeners(`Invalid mention type`, attrListCtx);
    }
    if (attrs['data-type'] !== 'element') {
      this.notifyErrorListeners(`Invalid mention type`, attrListCtx);
    }

    if (!(attrs['data-id'] in this.elementVisits)) {
      this.notifyErrorListeners(`Invalid element mention`, attrListCtx);
    }
    return true;
  }
}
