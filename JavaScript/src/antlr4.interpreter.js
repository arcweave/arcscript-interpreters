import antlr4 from 'antlr4';
import { clearBlockStyle, joinParagraphs } from './utils.js';
import ArcscriptLexer from './Generated/ArcscriptLexer.js';
import ArcscriptParser from './Generated/ArcscriptParser.js';
import ArcscriptVisitor from './ArcscriptVisitor.js';
import ErrorListener from './ErrorListener.js';

export default class Interpreter {
  /**
   * Interpreter constructor
   * @param {object} varValues
   * @param {object} varObjects
   * @param {object} elementVisits    The current element visits
   * @param {String} currentElement   The current element ID
   * @param {Function} onEvent       The event callback
   */
  constructor(
    varValues,
    varObjects,
    elementVisits = {},
    currentElement = '',
    eventHandler = () => {}
  ) {
    this.varValues = varValues;
    this.varObjects = varObjects;
    this.elementVisits = elementVisits;
    this.currentElement = currentElement;
    this.variableOffsets = [];
    this.emit = eventHandler;
  }

  runScript(code, varValues = {}) {
    this.outputs = [];
    this.variableOffsets = [];
    const { chars, lexer, tokens, parser, tree } = this.parse(code);

    const visitor = new ArcscriptVisitor(
      this.varValues,
      this.varObjects,
      this.elementVisits,
      this.currentElement,
      this.emit
    );
    Object.entries(varValues).forEach(([key, value]) => {
      visitor.state.changes[key] = value;
    });
    const result = tree.accept(visitor);

    let output = visitor.state.generateOutput();
    output = clearBlockStyle(output);
    return {
      changes: visitor.state.changes,
      output,
      result,
    };
  }

  parse(code) {
    const chars = new antlr4.InputStream(code);
    const lexer = new ArcscriptLexer(chars);
    const errorListener = new ErrorListener();
    lexer.removeErrorListeners(errorListener);
    lexer.addErrorListener(errorListener);
    const tokens = new antlr4.CommonTokenStream(lexer);
    const parser = new ArcscriptParser({
      input: tokens,
      varObjects: this.varObjects,
      elementVisits: this.elementVisits,
      currentElement: this.currentElement,
    });
    parser.buildParseTrees = true;
    parser.removeErrorListeners();
    parser.addErrorListener(errorListener);
    const tree = parser.input();
    // const visitor = new ArcscriptVisitor();

    return {
      chars,
      lexer,
      tokens,
      parser,
      tree,
    };
  }

  replaceVariables(code, variables) {
    const chars = new antlr4.InputStream(code);
    const lexer = new ArcscriptLexer(chars);
    const errorListener = new ErrorListener();
    lexer.removeErrorListeners(errorListener);
    lexer.addErrorListener(errorListener);

    const tokenTypeNames = lexer.getSymbolicNames();
    const allTokens = lexer.getAllTokens();
    const variableTokens = allTokens.filter(
      token => tokenTypeNames[token.type] === 'VARIABLE'
    );

    variableTokens.forEach(varToken => {
      const targetVar = Object.values(this.varObjects).find(
        variable => variable.name === varToken.text
      );
      if (targetVar?.id) {
        varToken.id = targetVar.id;
      }
    });

    const f = variableTokens
      .filter(varToken =>
        varToken.id ? Object.keys(variables).includes(varToken.id) : false
      )
      .sort((a, b) => b.start - a.start);
    let newCode = code;
    f.forEach(varToken => {
      const { start } = varToken;
      const end = start + varToken.text.length;
      const replace = variables[varToken.id];
      newCode = newCode.slice(0, start) + replace + newCode.slice(end);
    });
    return newCode;
  }
}
