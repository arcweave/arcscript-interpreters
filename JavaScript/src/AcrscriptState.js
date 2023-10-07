import _ from 'lodash';

export default class ArcscriptState {
  constructor(varValues, varObjects, elementVisits, currentElement) {
    this.varValues = varValues;
    this.varObjects = varObjects;
    this.elementVisits = elementVisits;
    this.currentElement = currentElement;
    this.outputs = [];
    this.changes = {};
  }

  getVar(name) {
    return Object.values(this.varObjects).find(v => v.name === name);
  }

  getVarValue(id) {
    if (id in this.changes) return this.changes[id];
    return this.varValues[id];
  }

  setVarValues(ids, values) {
    ids.forEach((id, index) => {
      this.changes[id] = values[index];
    });
  }

  getInitialVarValues() {
    return Object.fromEntries(
      Object.entries(this.varObjects)
        .filter(([k, v]) => !v.children)
        .map(([k, v]) => [k, v.value])
    );
  }

  resetVarValues(ids) {
    const initial = _.cloneDeep(this.getInitialVarValues());
    const values = ids.map(id => initial[id]);
    this.setVarValues(ids, values);
  }
}
