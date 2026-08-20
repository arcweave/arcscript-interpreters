import { VarDef, VarValue } from './types.js';

export default class ArcscriptVariable {
  readonly id: string;
  readonly name: string;
  type: VarDef['type'];
  private value: VarValue;
  readonly defaultValue: VarValue;
  private changed = false;
  readonly scope: string | null;

  constructor({ id, name, defaultValue, type, value, scope }: VarDef) {
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

  hasChanged() {
    return this.changed;
  }

  setValue(newValue: VarValue) {
    this.value = newValue;
    this.changed = true;
  }

  getType() {
    return this.type;
  }
}
