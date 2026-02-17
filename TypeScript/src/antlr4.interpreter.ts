import antlr4, { CharStream } from 'antlr4';
import { clearBlockStyle } from './utils.js';
import ArcscriptLexer from './Generated/ArcscriptLexer.js';
import ArcscriptParser from './Generated/ArcscriptParser.js';
import ArcscriptVisitor from './ArcscriptVisitor.js';
import ErrorListener from './ErrorListener.js';
import { VarObject, VarValue } from './types.js';

export default class Interpreter {
  varValues: Record<string, VarValue>;
  varObjects: Record<string, VarObject>;
  elementVisits: Record<string, number>;
  currentElement: string;
  variableOffsets: { start: number; end: number }[];
  emit: (event: string, data?: unknown) => void;

  /**
   * Interpreter constructor
   * @param varValues
   * @param varObjects
   * @param elementVisits     The current element visits
   * @param currentElement    The current element ID
   * @param eventHandler      The event callback
   */
  constructor(
    varValues: Record<string, VarValue>,
    varObjects: Record<string, VarObject>,
    elementVisits: Record<string, number> = {},
    currentElement: string = '',
    eventHandler: (event: string, data?: unknown) => void = () => {}
  ) {
    this.varValues = varValues;
    this.varObjects = varObjects;
    this.elementVisits = elementVisits;
    this.currentElement = currentElement;
    this.variableOffsets = [];
    this.emit = eventHandler;
  }

  runScript(code: string, varValues: Record<string, VarValue> = {}) {
    this.variableOffsets = [];
    const { tree } = this.parse(code);

    const visitor = new ArcscriptVisitor(
      this.varValues,
      this.varObjects,
      this.elementVisits,
      this.currentElement,
      this.emit
    );

    const result = tree.accept(visitor);

    let output = visitor.state.generateOutput();
    output = clearBlockStyle(output);

    return {
      changes: visitor.state.getChanges(),
      output,
      result,
    };
  }

  parse(code: string) {
    const chars = new CharStream(code);
    const lexer = new ArcscriptLexer(chars);
    const errorListener = new ErrorListener();
    lexer.removeErrorListeners();
    lexer.addErrorListener(errorListener);
    const tokens = new antlr4.CommonTokenStream(lexer);
    const parser = new ArcscriptParser(tokens);
    parser.setOptions({
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

  replaceVariables(code: string, variables: Record<string, string>) {
    const chars = new CharStream(code);
    const lexer = new ArcscriptLexer(chars);
    const errorListener = new ErrorListener();
    lexer.removeErrorListeners();
    lexer.addErrorListener(errorListener);

    const tokenTypeNames = lexer.getSymbolicNames();
    const allTokens = lexer.getAllTokens();
    const variableTokens = allTokens.filter(
      token => tokenTypeNames[token.type] === 'VARIABLE'
    );

    const tokenIdMap = new Map<object, string>();
    variableTokens.forEach(varToken => {
      const targetVar = Object.values(this.varObjects).find(
        variable => variable.name === varToken.text
      );
      if (targetVar?.id) {
        tokenIdMap.set(varToken, targetVar.id);
      }
    });

    const f = variableTokens
      .filter(varToken =>
        tokenIdMap.has(varToken)
          ? Object.keys(variables).includes(tokenIdMap.get(varToken)!)
          : false
      )
      .sort((a, b) => b.start - a.start);
    let newCode = code;
    f.forEach(varToken => {
      const { start } = varToken;
      const end = start + varToken.text.length;
      const replace = variables[tokenIdMap.get(varToken)!];
      newCode = newCode.slice(0, start) + replace + newCode.slice(end);
    });
    return newCode;
  }
}
