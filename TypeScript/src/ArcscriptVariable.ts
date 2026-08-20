import { VarDef, VarValue } from './types.js';

export default class ArcscriptVariable {
  readonly id: string;
  readonly name: string;
  private value: VarValue;
  readonly defaultValue: VarValue;
  private changed = false;
  readonly scope: string | null;

  constructor({ id, name, defaultValue, value, scope }: VarDef) {
    this.id = id;
    this.name = name;
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
}
