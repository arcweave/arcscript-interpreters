import cloneDeep from 'lodash.clonedeep';
import { joinParagraphs, joinSameTypes } from './utils.js';

export default class ArcscriptState {
  constructor(varValues, varObjects, elementVisits, currentElement) {
    this.varValues = varValues;
    this.varObjects = varObjects;
    this.elementVisits = elementVisits;
    this.currentElement = currentElement;
    this.outputs = [];
    this.conditionDepth = 0;
    this.inBlockQuote = false;
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
    const initial = cloneDeep(this.getInitialVarValues());
    const values = ids.map(id => initial[id]);
    this.setVarValues(ids, values);
  }

  /**
   * Adds an output to the array. The array has info on the current condition depth,
   * the type of the output pushed (blockquote or paragraph), and if comes from a script
   * (i.e. using 'show' function)
   * @param {string} output The output
   * @param {boolean} fromScript If the output comes from a script
   */
  pushOutput(output, fromScript) {
    this.outputs.push({
      output,
      index: this.conditionDepth,
      type: this.inBlockQuote ? 'blockquote' : 'p',
      fromScript,
      isScript: false,
    });
  }

  /**
   * Adds to the outputs the existanse of a script "generateOutput" will be able
   * to recognize when to concatenate paragraphs
   */
  addScript() {
    this.outputs.push({
      isScript: true,
    });
  }

  /**
   * Concatenates the outputs and transforms them to a single string
   * @returns {String} The output to be shown
   */
  generateOutput() {
    let output = '';
    this.outputs.forEach((obj, index) => {
      if (obj.isScript) return; // Doesn't have an output
      if (index === 0) {
        // The first output
        output = obj.output ?? '';
        return;
      }
      if (obj.fromScript) {
        // If output comes from a script, concatenate it with the previous block
        output = joinParagraphs(output, obj.output);
        return;
      }
      if (
        this.outputs[index - 1].fromScript ||
        this.outputs[index - 1].isScript ||
        obj.index !== this.outputs[index - 1].index
      ) {
        // If the previous block was a script or comes from a script,
        // or the conditionDepth is different, concatenate
        // the outputs only if they are of the same type
        output = joinSameTypes(output, obj.output);
        return;
      }
      output += obj.output;
    });
    return output;
  }
}
