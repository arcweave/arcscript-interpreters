import antlr4, { CharStream } from 'antlr4';
import { clearBlockStyle } from './utils.js';
import ArcscriptLexer from './Generated/ArcscriptLexer.js';
import ArcscriptParser from './Generated/ArcscriptParser.js';
import ArcscriptVisitor from './ArcscriptVisitor.js';
import ErrorListener from './ErrorListener.js';
import { ArcscriptStateDef, VarDef, VarValue } from './types.js';
import ArcscriptState from './ArcscriptState.js';

export default class Interpreter {
  arcscriptVariables: ArcscriptStateDef;
  state: ArcscriptState | null = null;
  elementVisits: Record<string, number>;
  currentElement: string;
  variableOffsets: { start: number; end: number }[];
  emit: (event: string, data?: unknown) => void;

  /**
   * Interpreter constructor
   * @param arcscriptVariables
   * @param elementVisits     The current element visits
   * @param currentElement    The current element ID
   * @param eventHandler      The event callback
   */
  constructor(
    arcscriptVariables: ArcscriptStateDef,
    elementVisits: Record<string, number> = {},
    currentElement: string = '',
    eventHandler: (event: string, data?: unknown) => void = () => {}
  ) {
    this.arcscriptVariables = arcscriptVariables;
    this.elementVisits = elementVisits;
    this.currentElement = currentElement;
    this.variableOffsets = [];
    this.emit = eventHandler;
  }

  runScript(code: string, varValues: Record<string, VarValue> = {}) {
    this.variableOffsets = [];

    this.state = new ArcscriptState(
      this.arcscriptVariables,
      this.elementVisits,
      this.currentElement,
      this.emit
    );

    const { tree } = this.parse(code);

    const visitor = new ArcscriptVisitor(this.state);

    const varIds: string[] = [];
    const varValuesList: VarValue[] = [];
    Object.entries(varValues).forEach(([id, value]) => {
      varIds.push(id);
      varValuesList.push(value);
    });
    this.state.setVarValues(varIds, varValuesList);

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
      arcscriptVariables: this.arcscriptVariables,
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
      token => tokenTypeNames[token.type] === 'IDENTIFIER'
    );

    const tokenIdMap = new Map<object, string>();
    variableTokens.forEach(varToken => {
      let targetVar: VarDef | null = null;
      for (const scopeVars of Object.values(this.arcscriptVariables)) {
        const v = Object.values(scopeVars).find(
          variable => variable.name === varToken.text
        );
        if (v) {
          targetVar = v;
          break;
        }
      }
      if (targetVar !== null) {
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
