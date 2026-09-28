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

export type LegacyVariableRewriteOptions = {
  /**
   * All board/component scope names in the project. Keep duplicates so an
   * ambiguous scope shared by more than one container can be detected.
   */
  scopeNames?: readonly string[];
};

export type LegacyVariableRewriteResult = {
  code: string;
  blockedVariableIds: string[];
};
