import { ArcscriptStateDef, VarType } from './types.js';
import { isGlobalScope } from './scope.js';

export type ArcscriptReference = Readonly<{
  kind: 'variable';
  variableId: string;
  type: VarType;
}>;

// A snapshot of declarations, shared by parsing and execution.
export default class ArcscriptContext {
  private readonly references = new Map<string, ArcscriptReference>();

  constructor(variables: ArcscriptStateDef = {}) {
    for (const variable of Object.values(variables)) {
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
          })
        );
    }
  }

  resolve(name: string): ArcscriptReference | undefined {
    return this.references.get(name);
  }
}
