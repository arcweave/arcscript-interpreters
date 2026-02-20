export type VarValue = string | number | boolean;
export type VarType = 'string' | 'integer' | 'float' | 'boolean';

export type VarDef = {
  id: string;
  name: string;
  type: VarType;
  defaultValue: VarValue;
};

export type MentionResult = {
  attrs: Record<string, string | boolean>;
  label: string;
};

export type VariableScope = 'global' | 'components' | 'elements';

export type ArcscriptStateDef = {
  [key in VariableScope]?: Record<string, VarDef>;
};
