export type VarValue = string | number | boolean;
export type VarType = 'string' | 'integer' | 'float' | 'boolean';

export type EnumMemberDef = {
  id: string;
  name: string;
  value: string | number;
};

export type EnumDef = {
  id: string;
  name: string;
  type: 'string' | 'integer';
  members: EnumMemberDef[];
};

export type ArcscriptEnumDefs = Record<string, EnumDef>;

export type VarDef = {
  id: string;
  name: string;
  type: VarType;
  defaultValue: VarValue;
  value?: VarValue;
  scope?: string | null;
  enumId?: string | null;
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
