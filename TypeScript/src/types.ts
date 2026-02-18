export type VarValue = string | number | boolean;
export type VarType = 'string' | 'integer' | 'float' | 'boolean';

export type VarObject = {
  id: string;
  name: string;
  type: VarType;
  value: VarValue;
  children?: string[];
};

export type MentionResult = {
  attrs: Record<string, string | boolean>;
  label: string;
};
