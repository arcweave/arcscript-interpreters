import { ParseError } from './errors/index.js';
import { ArcscriptEnumDefs, ArcscriptStateDef, VarType } from './types.js';
import { isGlobalScope } from './scope.js';

// Portable enum identifiers; ordinary Arcscript variable names are unchanged.
const reservedNames = new Set(
  'abs max min random roll round sqr sqrt visits show resetVisits reset resetAll if else elseif endif and or is not true false abstract as assert async auto await base bool break byte case catch char checked class const constexpr const_cast continue decimal default delegate delete do double dynamic elif enum event explicit export extends extern false final finally fixed float for foreach friend from func get global goto if implicit import in inline int interface internal is lock long match mutable namespace native new noexcept not not_eq null nullptr object operator or or_eq out override params pass private protected public readonly ref register reinterpret_cast return sbyte sealed set short signal signed sizeof stackalloc static static_assert static_cast string struct super switch template this thread_local throw throws trait try typedef typeid typename typeof uint ulong unchecked union unsafe unsigned using ushort var virtual void volatile wchar_t when where while with yield alignas alignof and_eq asm bitand bitor char8_t char16_t char32_t compl concept co_await co_return co_yield consteval constinit decltype dynamic_cast requires xor xor_eq class_name breakpoint preload self PI TAU INF NAN tool onready setget remote master puppet remotesync mastersync puppetsync'.split(
    ' '
  )
);

export type ArcscriptReference = Readonly<
  | { kind: 'variable'; variableId: string; type: VarType; enumId?: string }
  | {
      kind: 'enumMember';
      enumId: string;
      memberId: string;
      type: 'string' | 'integer';
      value: string | number;
    }
>;

// A validated snapshot of declarations, shared by parsing and execution.
export default class ArcscriptContext {
  private readonly references = new Map<string, ArcscriptReference>();
  private readonly enumTypes = new Map<string, 'string' | 'integer'>();

  constructor(
    definitions: ArcscriptEnumDefs = {},
    variables: ArcscriptStateDef = {},
    scopeNames: readonly string[] = []
  ) {
    const scopes = new Set(scopeNames);
    Object.values(variables).forEach(variable => {
      if (!isGlobalScope(variable.scope)) scopes.add(variable.scope!);
    });
    const names = new Set<string>();
    for (const [id, definition] of Object.entries(definitions)) {
      this.assertName(definition.name);
      if (!id || id !== definition.id || names.has(definition.name)) {
        throw new ParseError(
          'Enum IDs and names must be unique and match their keys'
        );
      }
      if (scopes.has(definition.name)) {
        throw new ParseError(
          `Enum ${definition.name} conflicts with a variable scope`
        );
      }
      names.add(definition.name);
      if (
        !['string', 'integer'].includes(definition.type) ||
        !definition.members.length
      ) {
        throw new ParseError(
          `Enum ${definition.name} must have string or integer members`
        );
      }
      this.enumTypes.set(id, definition.type);
      const memberIds = new Set<string>();
      const memberNames = new Set<string>();
      const values = new Set<string | number>();
      for (const member of definition.members) {
        this.assertName(member.name);
        if (
          !member.id ||
          memberIds.has(member.id) ||
          memberNames.has(member.name) ||
          values.has(member.value)
        ) {
          throw new ParseError(
            `Enum ${definition.name} has duplicate or missing members`
          );
        }
        if (
          (definition.type === 'string' && typeof member.value !== 'string') ||
          (definition.type === 'integer' &&
            (typeof member.value !== 'number' ||
              !Number.isInteger(member.value) ||
              member.value < -2147483648 ||
              member.value > 2147483647))
        ) {
          throw new ParseError(
            `Invalid backing value for ${definition.name}.${member.name}`
          );
        }
        memberIds.add(member.id);
        memberNames.add(member.name);
        values.add(member.value);
        this.references.set(
          `${definition.name}.${member.name}`,
          Object.freeze({
            kind: 'enumMember',
            enumId: id,
            memberId: member.id,
            type: definition.type,
            value: member.value,
          })
        );
      }
    }
    for (const variable of Object.values(variables)) {
      if (
        variable.enumId !== undefined &&
        this.enumTypes.get(variable.enumId) !== variable.type
      ) {
        throw new ParseError(
          `Invalid enum reference for variable ${variable.name}`
        );
      }
      const name = isGlobalScope(variable.scope)
        ? variable.name
        : `${variable.scope}.${variable.name}`;
      // Preserve the existing first-match behavior for ordinary variable names.
      if (!this.references.has(name))
        this.references.set(
          name,
          Object.freeze({
            kind: 'variable',
            variableId: variable.id,
            type: variable.type,
            enumId: variable.enumId,
          })
        );
    }
  }

  private assertName(name: string) {
    if (
      !/^[A-Za-z][A-Za-z0-9_]*$/.test(name) ||
      name.includes('__') ||
      reservedNames.has(name)
    ) {
      throw new ParseError(`Invalid or reserved enum identifier ${name}`);
    }
  }

  resolve(name: string): ArcscriptReference | undefined {
    return this.references.get(name);
  }

  get hasEnums(): boolean {
    return this.enumTypes.size > 0;
  }

  enumType(id: string): 'string' | 'integer' | undefined {
    return this.enumTypes.get(id);
  }
}
