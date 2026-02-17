import { VarValue } from './types.js';

type ArcscriptVariableParams = {
  id: string;
  name: string;
  type: string;
  defaultValue: VarValue;
  value?: VarValue;
};

export default class ArcscriptVariable {
  id: string;
  name: string;
  type: string;
  value: VarValue;
  defaultValue: VarValue;
  changed = false;

  constructor({
    id,
    name,
    defaultValue,
    type,
    value,
  }: ArcscriptVariableParams) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.defaultValue = defaultValue;

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
