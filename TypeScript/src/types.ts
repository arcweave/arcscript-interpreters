export type VarValue = string | number | boolean;
export type VarType = 'string' | 'integer' | 'float' | 'boolean';

export type VarDef = {
  id: string;
  name: string;
  type: VarType;
  defaultValue: VarValue;
  value?: VarValue;
  scope?: string | null;
};

export type MentionResult = {
  attrs: Record<string, string | boolean>;
  label: string;
};

export type ArcscriptStateDef = Record<string, VarDef>;
