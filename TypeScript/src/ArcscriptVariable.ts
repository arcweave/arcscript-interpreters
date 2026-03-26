import { VarValue } from './types.js';

type ArcscriptVariableParams = {
  id: string;
  name: string;
  type: string;
  defaultValue: VarValue;
  value?: VarValue;
  scope?: string | null;
};

export default class ArcscriptVariable {
  id: string;
  name: string;
  type: string;
  value: VarValue;
  defaultValue: VarValue;
  changed = false;
  scope: string | null;

  constructor({
    id,
    name,
    defaultValue,
    type,
    value,
    scope,
  }: ArcscriptVariableParams) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.defaultValue = defaultValue;
    this.scope = scope || null;

    if (value !== undefined) {
      this.value = value;
      this.changed = true;
    } else {
      this.value = defaultValue;
    }
  }

  reset() {
    this.value = this.defaultValue;
    this.changed = true;
  }

  getValue() {
    return this.value;
  }

  setValue(newValue: VarValue) {
    this.value = newValue;
    this.changed = true;
  }

  getType() {
    return this.type;
  }
}
