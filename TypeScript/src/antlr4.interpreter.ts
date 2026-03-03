import antlr4, { CharStream } from 'antlr4';
import { clearBlockStyle } from './utils.js';
import ArcscriptLexer from './Generated/ArcscriptLexer.js';
import ArcscriptParser from './Generated/ArcscriptParser.js';
import ArcscriptVisitor from './ArcscriptVisitor.js';
import ErrorListener from './ErrorListener.js';
import { ArcscriptStateDef, VarValue } from './types.js';
import ArcscriptState from './ArcscriptState.js';

type ArcscriptInterpreterOptions = {
  state: ArcscriptStateDef;
  elementVisits?: Record<string, number>;
  currentElement?: string;
  eventHandler?: (event: string, data?: unknown) => void;
};

export default class Interpreter {
  arcscriptVariables: ArcscriptStateDef;
  state: ArcscriptState | null = null;
  elementVisits: Record<string, number>;
  currentElement: string;
  variableOffsets: { start: number; end: number }[];
  emit: (event: string, data?: unknown) => void;

  constructor(options = {} as ArcscriptInterpreterOptions) {
    this.arcscriptVariables = options.state;
    this.elementVisits = options.elementVisits || {};
    this.currentElement = options.currentElement || '';
    this.variableOffsets = [];
    this.emit = options.eventHandler || (() => {});
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
    // this.state.setVarValues(varIds, varValuesList);

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
    const tokenIdMap = new Map<object, string>();
    const stateVars = Object.values(this.arcscriptVariables);

    allTokens.forEach((token, index) => {
      if (tokenTypeNames[token.type] !== 'IDENTIFIER') {
        return;
      }

      // Identifier followed by dot is a scope qualifier (e.g. comp1.a).
      const nextToken = allTokens[index + 1];
      if (nextToken && tokenTypeNames[nextToken.type] === 'DOT') {
        return;
      }

      let targetVar: (typeof stateVars)[number] | null = null;
      const previousToken = allTokens[index - 1];
      if (previousToken && tokenTypeNames[previousToken.type] === 'DOT') {
        const scopeToken = allTokens[index - 2];
        if (scopeToken && tokenTypeNames[scopeToken.type] === 'IDENTIFIER') {
          targetVar =
            stateVars.find(
              variable =>
                variable.scope === scopeToken.text &&
                variable.name === token.text
            ) ?? null;
        }
      } else {
        targetVar =
          stateVars.find(variable => variable.name === token.text) ?? null;
      }

      if (targetVar) {
        tokenIdMap.set(token, targetVar.id);
      }
    });

    const variableTokens = allTokens.filter(token => tokenIdMap.has(token));
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
