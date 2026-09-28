import { decodeHTMLStrict } from 'entities';
import ArcscriptLexer from './Generated/ArcscriptLexer.js';
import type {
  ArcscriptStateDef,
  LegacyVariableRewriteOptions,
  LegacyVariableRewriteResult,
} from './types.js';
import { isGlobalScope } from './scope.js';
import { CharStream } from 'antlr4';

type SourceRange = {
  start: number;
  end: number;
};

type DecodedSource = {
  text: string;
  sourceUnits: SourceRange[];
};

type Candidate = {
  id: string;
  oldName: string;
  newName: string;
  scope: string | null;
};

type CandidateMatch = {
  candidate: Candidate;
  start: number;
  end: number;
  replacementStart: number;
  replacementEnd: number;
};

type SourceReplacement = {
  start: number;
  end: number;
  text: string;
};

const CALLABLE_RESERVED_NAMES = new Set([
  'sqr',
  'sqrt',
  'abs',
  'random',
  'roll',
  'show',
  'reset',
  'resetAll',
  'resetVisits',
  'min',
  'max',
  'round',
  'visits',
]);

const RESERVED_NAMES = new Set([
  ...CALLABLE_RESERVED_NAMES,
  'if',
  'endif',
  'else',
  'elseif',
  'and',
  'or',
  'not',
  'is',
  'true',
  'false',
]);

const OPERATOR_TOKEN_NAMES = new Set([
  'LPAREN',
  'RPAREN',
  'ASSIGNMUL',
  'ASSIGNDIV',
  'ASSIGNADD',
  'ASSIGNSUB',
  'ASSIGNMOD',
  'MUL',
  'DIV',
  'ADD',
  'SUB',
  'MOD',
  'GE',
  'GT',
  'LE',
  'LT',
  'EQ',
  'NE',
  'AND',
  'OR',
  'ASSIGN',
  'NEG',
  'COMMA',
  'LBRACE',
  'RBRACE',
  'IFKEYWORD',
  'ELSEKEYWORD',
  'ELSEIFKEYWORD',
  'ENDIFKEYWORD',
  'ANDKEYWORD',
  'ORKEYWORD',
  'ISKEYWORD',
  'NOTKEYWORD',
]);

const DELIMITER_TOKEN_NAMES = new Set([
  'LPAREN',
  'RPAREN',
  'COMMA',
  'LBRACE',
  'RBRACE',
]);

const EXPRESSION_KEYWORDS_BEFORE = new Set([
  'IFKEYWORD',
  'ELSEIFKEYWORD',
  'ANDKEYWORD',
  'ORKEYWORD',
  'ISKEYWORD',
  'NOTKEYWORD',
]);

const EXPRESSION_KEYWORDS_AFTER = new Set([
  'ANDKEYWORD',
  'ORKEYWORD',
  'ISKEYWORD',
]);

const IDENTIFIER_PART_PATTERN = /^[\p{L}\p{N}\p{M}_$]$/u;

export default class LegacyVariableReferenceRewriter {
  constructor(
    private readonly state: ArcscriptStateDef,
    private readonly parsesAsArcscript: (code: string) => boolean
  ) {}

  rewrite(
    code: string,
    replacementsByVariableId: Record<string, string>,
    options: LegacyVariableRewriteOptions = {}
  ): LegacyVariableRewriteResult {
    const candidates = Object.values(this.state)
      .filter(variable => Object.hasOwn(replacementsByVariableId, variable.id))
      .map(variable => ({
        id: variable.id,
        oldName: variable.name,
        newName: replacementsByVariableId[variable.id],
        scope: isGlobalScope(variable.scope)
          ? null
          : (variable.scope as string),
      }));
    const blocked = this.inherentlyBlockedCandidates(candidates, options);
    const decoded = this.decodeSource(code);
    const possibleMatches = candidates
      .filter(candidate => !blocked.has(candidate.id))
      .flatMap(candidate => this.candidateMatches(decoded.text, candidate));
    const protectedRanges = this.protectedRanges(decoded.text, possibleMatches);
    const matches = this.nonOverlappingMatches(
      possibleMatches.filter(
        match =>
          !protectedRanges.some(range => this.rangesOverlap(range, match))
      )
    ).map(match => ({
      ...match,
      replacementStart:
        decoded.sourceUnits[match.replacementStart]?.start ?? code.length,
      replacementEnd:
        decoded.sourceUnits[match.replacementEnd - 1]?.end ?? code.length,
    }));

    const matchesByCandidate = new Map<string, CandidateMatch[]>();
    for (const match of matches) {
      const candidateMatches = matchesByCandidate.get(match.candidate.id) ?? [];
      candidateMatches.push(match);
      matchesByCandidate.set(match.candidate.id, candidateMatches);
    }

    for (const candidate of candidates) {
      if (
        (matchesByCandidate.get(candidate.id)?.length ?? 0) > 0 &&
        this.isAmbiguous(candidate, candidates, options)
      ) {
        blocked.add(candidate.id);
      }
    }

    const sourceReplacements = matches
      .filter(match => !blocked.has(match.candidate.id))
      .map(match => ({
        start: match.replacementStart,
        end: match.replacementEnd,
        text: match.candidate.newName,
      }));

    return {
      code: this.applyReplacements(code, sourceReplacements),
      blockedVariableIds: [...blocked].sort(),
    };
  }

  private inherentlyBlockedCandidates(
    candidates: Candidate[],
    options: LegacyVariableRewriteOptions
  ) {
    const blocked = new Set<string>();
    const scopeNames = options.scopeNames ?? [
      ...new Set(
        Object.values(this.state)
          .map(variable => variable.scope)
          .filter((scope): scope is string => !isGlobalScope(scope))
      ),
    ];
    const scopeCounts = new Map<string, number>();
    for (const scope of scopeNames) {
      scopeCounts.set(scope, (scopeCounts.get(scope) ?? 0) + 1);
    }

    for (const candidate of candidates) {
      if (
        candidate.oldName.length === 0 ||
        !this.isValidIdentifier(candidate.newName) ||
        RESERVED_NAMES.has(candidate.newName) ||
        (candidate.scope !== null &&
          (!this.isValidIdentifier(candidate.scope) ||
            RESERVED_NAMES.has(candidate.scope) ||
            (scopeCounts.get(candidate.scope) ?? 0) > 1))
      ) {
        blocked.add(candidate.id);
      }
    }

    const duplicateNames = new Map<string, string[]>();
    const candidateIds = new Set(candidates.map(candidate => candidate.id));
    for (const variable of Object.values(this.state)) {
      const scope = isGlobalScope(variable.scope)
        ? ''
        : (variable.scope as string);
      const key = `${scope}\0${variable.name}`;
      const ids = duplicateNames.get(key) ?? [];
      ids.push(variable.id);
      duplicateNames.set(key, ids);
    }
    for (const ids of duplicateNames.values()) {
      if (ids.length > 1) {
        ids.filter(id => candidateIds.has(id)).forEach(id => blocked.add(id));
      }
    }

    return blocked;
  }

  private candidateMatches(text: string, candidate: Candidate) {
    const matches: CandidateMatch[] = [];
    if (candidate.scope === null) {
      let start = text.indexOf(candidate.oldName);
      while (start !== -1) {
        const end = start + candidate.oldName.length;
        if (
          this.hasIdentifierBoundaries(text, start, end) &&
          this.hasWhitespaceNameBoundaries(
            text,
            start,
            end,
            candidate.oldName
          ) &&
          !this.isMemberExpressionPart(text, start, end) &&
          !this.isCallableInvocation(text, end, candidate.oldName)
        ) {
          matches.push({
            candidate,
            start,
            end,
            replacementStart: start,
            replacementEnd: end,
          });
        }
        start = text.indexOf(candidate.oldName, start + 1);
      }

      return matches;
    }

    let scopeStart = text.indexOf(candidate.scope);
    while (scopeStart !== -1) {
      let position = scopeStart + candidate.scope.length;
      while (this.isWhitespace(text[position])) position += 1;
      if (text[position] === '.') {
        position += 1;
        while (this.isWhitespace(text[position])) position += 1;
        if (text.startsWith(candidate.oldName, position)) {
          const end = position + candidate.oldName.length;
          if (
            this.hasIdentifierBoundaries(text, scopeStart, end) &&
            this.hasWhitespaceNameBoundaries(
              text,
              position,
              end,
              candidate.oldName
            )
          ) {
            matches.push({
              candidate,
              start: scopeStart,
              end,
              replacementStart: position,
              replacementEnd: end,
            });
          }
        }
      }
      scopeStart = text.indexOf(candidate.scope, scopeStart + 1);
    }

    return matches;
  }

  private nonOverlappingMatches(matches: CandidateMatch[]) {
    const byStart = new Map<number, CandidateMatch[]>();
    for (const match of matches) {
      const matchesAtStart = byStart.get(match.start) ?? [];
      matchesAtStart.push(match);
      matchesAtStart.sort(
        (left, right) =>
          right.end - right.start - (left.end - left.start) ||
          left.candidate.id.localeCompare(right.candidate.id)
      );
      byStart.set(match.start, matchesAtStart);
    }

    const outside: CandidateMatch[] = [];
    let position = Math.min(...byStart.keys());
    const lastPosition = Math.max(...byStart.keys());
    while (position <= lastPosition) {
      const match = byStart.get(position)?.[0];
      if (match) {
        outside.push(match);
        position = match.end;
        continue;
      }
      position += 1;
    }

    return outside;
  }

  private isAmbiguous(
    candidate: Candidate,
    candidates: Candidate[],
    options: LegacyVariableRewriteOptions
  ) {
    const name = candidate.oldName.trim();
    const tokens = this.tokensForCode(name);
    if (
      tokens.tokenNames[0] === 'INTEGER' ||
      tokens.tokenNames[0] === 'FLOAT'
    ) {
      return true;
    }
    if (RESERVED_NAMES.has(candidate.oldName)) {
      return !CALLABLE_RESERVED_NAMES.has(candidate.oldName);
    }
    if (candidate.scope === null && candidate.oldName.includes('.')) {
      const scopeNames = new Set(
        options.scopeNames ??
          Object.values(this.state)
            .map(variable => variable.scope)
            .filter((value): value is string => !isGlobalScope(value))
      );
      const dotIndex = tokens.tokenNames.indexOf('DOT');
      const scope = dotIndex > 0 ? tokens.tokens[dotIndex - 1].text : '';
      if (scope.length === 0 || scopeNames.has(scope)) {
        return true;
      }
    }

    const tokenNames = tokens.tokenNames;
    const hasOperator =
      tokenNames.some(name => OPERATOR_TOKEN_NAMES.has(name)) ||
      tokens.tokens.some(
        (token, index) =>
          tokenNames[index] === 'LEGACY_CHARACTER' &&
          '-+*/%<>=!&|(),{}'.includes(token.text)
      );
    if (!hasOperator) {
      return false;
    }
    if (tokenNames.some(name => DELIMITER_TOKEN_NAMES.has(name))) {
      return true;
    }
    if (
      this.isOperatorToken(tokens, 0) ||
      this.isOperatorToken(tokens, tokens.tokens.length - 1)
    ) {
      return true;
    }

    for (const other of candidates) {
      if (
        other.id !== candidate.id &&
        this.containsLegacyOperand(candidate.oldName, other.oldName)
      ) {
        return true;
      }
    }

    return this.parsesAsArcscript(
      candidate.scope === null
        ? candidate.oldName
        : `${candidate.scope}.${candidate.oldName}`
    );
  }

  private containsLegacyOperand(compoundName: string, legacyName: string) {
    let position = compoundName.indexOf(legacyName);
    while (position !== -1) {
      const end = position + legacyName.length;
      if (this.hasIdentifierBoundaries(compoundName, position, end)) {
        const outside =
          compoundName.slice(0, position) + compoundName.slice(end);
        const tokens = this.tokensForCode(outside);
        if (
          tokens.tokenNames.some(name => OPERATOR_TOKEN_NAMES.has(name)) ||
          tokens.tokens.some(
            (token, index) =>
              tokens.tokenNames[index] === 'LEGACY_CHARACTER' &&
              '-+*/%<>=!&|(),{}'.includes(token.text)
          )
        ) {
          return true;
        }
      }
      position = compoundName.indexOf(legacyName, position + 1);
    }

    return false;
  }

  private tokensForCode(code: string) {
    const wrapped = `<pre><code>${code}</code></pre>`;
    const lexer = this.createLenientLexer(wrapped);
    const tokenTypeNames = lexer.getSymbolicNames();
    const tokens = lexer
      .getAllTokens()
      .filter(
        token =>
          token.type !== ArcscriptLexer.CODESTART &&
          token.type !== ArcscriptLexer.CODEEND
      );

    return {
      tokens,
      tokenNames: tokens.map(token => tokenTypeNames[token.type]),
    };
  }

  private isOperatorToken(
    tokens: ReturnType<LegacyVariableReferenceRewriter['tokensForCode']>,
    index: number
  ) {
    return (
      OPERATOR_TOKEN_NAMES.has(tokens.tokenNames[index]) ||
      (tokens.tokenNames[index] === 'LEGACY_CHARACTER' &&
        '-+*/%<>=!&|(),{}'.includes(tokens.tokens[index].text))
    );
  }

  private protectedRanges(code: string, matches: CandidateMatch[]) {
    const prefix = '<pre><code>';
    const source = `${prefix}${this.maskLegacyMatches(code, matches)}</code></pre>`;
    const tokens = this.createLenientLexer(source).getAllTokens();
    const ranges: SourceRange[] = [];
    let mentionStart: number | null = null;
    for (const token of tokens) {
      const start = token.start - prefix.length;
      const end = token.stop + 1 - prefix.length;
      if (token.type === ArcscriptLexer.MENTION_TAG_OPEN) {
        mentionStart = start;
      } else if (
        token.type === ArcscriptLexer.MENTION_TAG_CLOSE &&
        mentionStart !== null
      ) {
        ranges.push({
          start: Math.max(0, mentionStart),
          end: Math.max(0, end),
        });
        mentionStart = null;
      } else if (token.type === ArcscriptLexer.STRING) {
        ranges.push({
          start: Math.max(0, start),
          end: Math.max(0, end),
        });
      } else if (
        token.type === ArcscriptLexer.LEGACY_CHARACTER &&
        (token.text === '"' || token.text === "'")
      ) {
        ranges.push({ start: Math.max(0, start), end: code.length });
      }
    }

    return ranges;
  }

  private maskLegacyMatches(code: string, matches: CandidateMatch[]) {
    const masked = code.split('');
    for (const match of this.nonOverlappingMatches(matches)) {
      const tokens = this.tokensForCode(match.candidate.oldName);
      if (
        match.candidate.oldName.startsWith('"') ||
        match.candidate.oldName.startsWith("'") ||
        tokens.tokenNames.includes('STRING')
      ) {
        continue;
      }

      for (let position = match.start; position < match.end; position += 1) {
        if (masked[position] !== '\\') {
          masked[position] = this.isEscapedCharacter(code, position)
            ? 'n'
            : 'x';
        }
      }
    }

    return masked.join('');
  }

  private createLenientLexer(code: string) {
    const lexer = new ArcscriptLexer(new CharStream(code));
    lexer.removeErrorListeners();
    return lexer;
  }

  private decodeSource(source: string): DecodedSource {
    let text = '';
    const sourceUnits: SourceRange[] = [];
    let position = 0;
    while (position < source.length) {
      if (source[position] === '&') {
        const semicolon = source.indexOf(';', position + 1);
        if (semicolon !== -1 && semicolon - position <= 64) {
          const encoded = source.slice(position, semicolon + 1);
          const decoded = decodeHTMLStrict(encoded);
          if (decoded !== encoded) {
            text += decoded;
            for (let index = 0; index < decoded.length; index += 1) {
              sourceUnits.push({
                start: position,
                end: semicolon + 1,
              });
            }
            position = semicolon + 1;
            continue;
          }
        }
      }

      const character = String.fromCodePoint(source.codePointAt(position)!);
      text += character;
      for (let index = 0; index < character.length; index += 1) {
        sourceUnits.push({
          start: position,
          end: position + character.length,
        });
      }
      position += character.length;
    }

    return { text, sourceUnits };
  }

  private hasIdentifierBoundaries(text: string, start: number, end: number) {
    const previous = this.codePointBefore(text, start);
    const next = String.fromCodePoint(text.codePointAt(end) ?? 0);
    return !this.isIdentifierPart(previous) && !this.isIdentifierPart(next);
  }

  private hasWhitespaceNameBoundaries(
    text: string,
    start: number,
    end: number,
    name: string
  ) {
    if (![...name].some(character => this.isWhitespace(character))) {
      return true;
    }

    let before = start - 1;
    while (before >= 0 && this.isWhitespace(text[before])) before -= 1;
    let after = end;
    while (after < text.length && this.isWhitespace(text[after])) after += 1;

    return (
      this.hasExpressionBoundaryBefore(text, before) &&
      this.hasExpressionBoundaryAfter(text, after)
    );
  }

  private hasExpressionBoundaryBefore(text: string, end: number) {
    if (!this.isIdentifierPart(this.codePointBefore(text, end + 1))) {
      return true;
    }

    let start = end;
    while (start >= 0 && this.isIdentifierPart(text[start])) start -= 1;
    const tokenName = this.tokensForCode(text.slice(start + 1, end + 1))
      .tokenNames[0];

    return EXPRESSION_KEYWORDS_BEFORE.has(tokenName);
  }

  private hasExpressionBoundaryAfter(text: string, start: number) {
    if (
      !this.isIdentifierPart(String.fromCodePoint(text.codePointAt(start) ?? 0))
    ) {
      return true;
    }

    let end = start;
    while (end < text.length && this.isIdentifierPart(text[end])) end += 1;
    const tokenName = this.tokensForCode(text.slice(start, end)).tokenNames[0];

    return EXPRESSION_KEYWORDS_AFTER.has(tokenName);
  }

  private isMemberExpressionPart(text: string, start: number, end: number) {
    let before = start - 1;
    while (before >= 0 && this.isWhitespace(text[before])) before -= 1;
    let after = end;
    while (after < text.length && this.isWhitespace(text[after])) after += 1;
    return text[before] === '.' || text[after] === '.';
  }

  private isCallableInvocation(text: string, end: number, name: string) {
    if (!CALLABLE_RESERVED_NAMES.has(name)) return false;
    while (end < text.length && this.isWhitespace(text[end])) end += 1;
    return text[end] === '(';
  }

  private isValidIdentifier(value: string) {
    const tokens = this.tokensForCode(value);

    return (
      tokens.tokens.length === 1 &&
      tokens.tokenNames[0] === 'IDENTIFIER' &&
      tokens.tokens[0].text === value
    );
  }

  private isIdentifierPart(value: string) {
    return value.length > 0 && IDENTIFIER_PART_PATTERN.test(value);
  }

  private isWhitespace(value: string | undefined) {
    return value !== undefined && /\s/u.test(value);
  }

  private codePointBefore(value: string, index: number) {
    if (index === 0) return '';
    const previous = value.charCodeAt(index - 1);
    const start =
      previous >= 0xdc00 && previous <= 0xdfff ? index - 2 : index - 1;
    return value.slice(start, index);
  }

  private isEscapedCharacter(value: string, index: number) {
    let backslashes = 0;
    for (
      let position = index - 1;
      position >= 0 && value[position] === '\\';
      position -= 1
    ) {
      backslashes += 1;
    }

    return backslashes % 2 === 1;
  }

  private rangesOverlap(left: SourceRange, right: SourceRange) {
    return left.start < right.end && right.start < left.end;
  }

  private applyReplacements(code: string, replacements: SourceReplacement[]) {
    return [...replacements]
      .sort((left, right) => right.start - left.start)
      .reduce(
        (updated, replacement) =>
          updated.slice(0, replacement.start) +
          replacement.text +
          updated.slice(replacement.end),
        code
      );
  }
}
