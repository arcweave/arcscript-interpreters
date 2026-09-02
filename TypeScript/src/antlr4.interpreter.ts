import antlr4, { CharStream } from 'antlr4';
import { clearBlockStyle } from './utils.js';
import ArcscriptLexer from './Generated/ArcscriptLexer.js';
import ArcscriptParser from './Generated/ArcscriptParser.js';
import ArcscriptVisitor from './ArcscriptVisitor.js';
import ErrorListener from './ErrorListener.js';
import { ArcscriptStateDef, VarValue } from './types.js';
import ArcscriptState from './ArcscriptState.js';
import { isGlobalScope } from './scope.js';

type ArcscriptInterpreterOptions = {
  state: ArcscriptStateDef;
  elementVisits?: Record<string, number>;
  currentElement?: string;
  eventHandler?: (event: string, data?: unknown) => void;
};

type SourceReplacement = {
  start: number;
  end: number;
  text: string;
};

export default class Interpreter {
  private readonly arcscriptVariables: ArcscriptStateDef;
  private readonly elementVisits: Record<string, number>;
  private readonly currentElement: string;
  private readonly emit: (event: string, data?: unknown) => void;

  constructor(options: ArcscriptInterpreterOptions = { state: {} }) {
    this.arcscriptVariables = options.state;
    this.elementVisits = options.elementVisits ?? {};
    this.currentElement = options.currentElement ?? '';
    this.emit = options.eventHandler ?? (() => {});
  }

  runScript(code: string, varValues: Record<string, VarValue> = {}) {
    const state = new ArcscriptState(
      this.arcscriptVariables,
      this.elementVisits,
      this.currentElement,
      this.emit
    );

    const { tree } = this.parse(code);

    const visitor = new ArcscriptVisitor(state);

    state.setVarValues(varValues);

    const result = tree.accept(visitor);
    const output = clearBlockStyle(state.generateOutput());

    return {
      changes: state.getChanges(),
      output,
      result,
    };
  }

  parse(code: string) {
    const { chars, lexer, errorListener } = this.createLexer(code);
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

    return {
      chars,
      lexer,
      tokens,
      parser,
      tree,
    };
  }

  replaceVariables(code: string, variables: Record<string, string>) {
    const { tokenTypeNames, allTokens } = this.parseTokens(code);
    const stateVars = Object.values(this.arcscriptVariables);
    const replacements: SourceReplacement[] = [];

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
          stateVars.find(
            variable =>
              variable.name === token.text && isGlobalScope(variable.scope)
          ) ?? null;
      }

      if (targetVar && Object.hasOwn(variables, targetVar.id)) {
        replacements.push({
          start: token.start,
          end: token.start + token.text.length,
          text: variables[targetVar.id],
        });
      }
    });

    return this.applyReplacements(code, replacements);
  }

  replaceScope(code: string, scope: string, replacement: string) {
    return this.replaceScopes(code, {
      [scope]: replacement,
    });
  }

  private replaceScopes(code: string, scopes: Record<string, string>) {
    const { tokenTypeNames, allTokens } = this.parseTokens(code);
    const stateVars = Object.values(this.arcscriptVariables);

    const targetScopeTokens = allTokens
      .filter((token, index) => {
        if (tokenTypeNames[token.type] !== 'IDENTIFIER') {
          return false;
        }

        const dotToken = allTokens[index + 1];
        const variableToken = allTokens[index + 2];
        if (
          !dotToken ||
          tokenTypeNames[dotToken.type] !== 'DOT' ||
          !variableToken ||
          tokenTypeNames[variableToken.type] !== 'IDENTIFIER'
        ) {
          return false;
        }

        return stateVars.some(
          variable =>
            variable.scope === token.text && variable.name === variableToken.text
        );
      })
      .filter(scopeToken =>
        Object.prototype.hasOwnProperty.call(scopes, scopeToken.text)
      );

    return this.applyReplacements(
      code,
      targetScopeTokens.map(scopeToken => ({
        start: scopeToken.start,
        end: scopeToken.start + scopeToken.text.length,
        text: scopes[scopeToken.text],
      }))
    );
  }

  private createLexer(code: string) {
    const chars = new CharStream(code);
    const lexer = new ArcscriptLexer(chars);
    const errorListener = new ErrorListener();
    lexer.removeErrorListeners();
    lexer.addErrorListener(errorListener);

    return { chars, lexer, errorListener };
  }

  private parseTokens(code: string) {
    const { lexer } = this.createLexer(code);

    return {
      tokenTypeNames: lexer.getSymbolicNames(),
      allTokens: lexer.getAllTokens(),
    };
  }

  private applyReplacements(
    code: string,
    replacements: SourceReplacement[]
  ) {
    return [...replacements]
      .sort((a, b) => b.start - a.start)
      .reduce(
        (updatedCode, replacement) =>
          updatedCode.slice(0, replacement.start) +
          replacement.text +
          updatedCode.slice(replacement.end),
        code
      );
  }
}
