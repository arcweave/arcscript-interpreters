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
    this.changes = {};

    this.outputDoc = document.implementation.createHTMLDocument();
    this.inBlockquote = false;
    this.insertBlockquote = false;
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
    let previousOutput = null;
    if (this.outputs.length > 0) {
      previousOutput = this.outputs[this.outputs.length - 1];
    }

    this.outputs.push({
      output,
      index: this.conditionDepth,
      fromScript,
      inBlockquote: this.inBlockquote,
      isScript: false,
    });

    let outputNode = new DOMParser().parseFromString(output, 'text/html').body
      .firstChild;

    // If this is the first output to be inserted
    if (!this.outputDoc.body.innerHTML) {
      if (this.insertBlockquote) {
        const newNode = this.outputDoc.createElement('blockquote');
        newNode.appendChild(outputNode);
        outputNode = newNode;
        this.insertBlockquote = false;
      }
      this.outputDoc.body.appendChild(outputNode);
    }
    // If current output is coming from a script, we are merging it with the previous output
    else if (fromScript) {
      if (this.insertBlockquote) {
        const newNode = this.outputDoc.createElement('blockquote');
        newNode.appendChild(outputNode);
        outputNode = newNode;
        this.insertBlockquote = false;
        this.outputDoc.body.appendChild(outputNode);
      } else if (outputNode.innerHTML) {
        const children = this.outputDoc.body.querySelectorAll('p:last-child');
        if (children[children.length - 1].innerHTML === '') {
          children[children.length - 1].innerHTML = outputNode.innerHTML;
        } else {
          children[children.length - 1].innerHTML += ` ${outputNode.innerHTML}`;
        }
      }
    }
    // If the previous output was from a script, the node was a script or
    // the condition depth is different, merge if the nodes are of the same type
    else if (
      previousOutput.fromScript ||
      previousOutput.isScript ||
      previousOutput.index !== this.conditionDepth
    ) {
      const nodeName = this.inBlockquote ? 'BLOCKQUOTE' : 'P';
      const previousNode = this.outputDoc.body.lastChild;
      if (previousNode.nodeName === nodeName) {
        if (outputNode.innerHTML) {
          const children = this.outputDoc.body.querySelectorAll('p:last-child');
          if (children[children.length - 1].innerHTML === '') {
            children[children.length - 1].innerHTML = outputNode.innerHTML;
          } else {
            children[
              children.length - 1
            ].innerHTML += ` ${outputNode.innerHTML}`;
          }
        }
      } else {
        if (this.insertBlockquote) {
          const newNode = this.outputDoc.createElement('blockquote');
          newNode.appendChild(outputNode);
          outputNode = newNode;
          this.insertBlockquote = false;
        }
        this.outputDoc.body.appendChild(outputNode);
      }
    } else if (this.inBlockquote) {
      if (this.insertBlockquote) {
        const newNode = this.outputDoc.createElement('blockquote');
        newNode.appendChild(outputNode);
        this.outputDoc.body.appendChild(newNode);

        this.insertBlockquote = false;
      } else {
        this.outputDoc
          .querySelector('blockquote:last-child')
          .appendChild(outputNode);
      }
    } else {
      this.outputDoc.body.appendChild(outputNode);
    }

    this.insertBlockquote = false;
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

  addBlockquoteStart() {
    this.insertBlockquote = true;
    this.inBlockquote = true;
  }

  addBlockquoteEnd() {
    this.inBlockquote = false;
  }

  incrConditionDepth() {
    this.conditionDepth += 1;
  }

  decrConditionDepth() {
    this.conditionDepth -= 1;
  }

  /**
   * Concatenates the outputs and transforms them to a single string
   * @returns {String} The output to be shown
   */
  generateOutput() {
    return this.outputDoc.body.innerHTML;
  }
}
