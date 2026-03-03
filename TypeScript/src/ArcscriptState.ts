import { ArcscriptStateDef, VarDef, VarValue } from './types.js';
import ArcscriptVariable from './ArcscriptVariable.js';

function hasProperty<T extends object>(obj: T, prop: keyof T): boolean {
  if (Object.hasOwn) {
    return Object.hasOwn(obj, prop);
  }
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

function validateVarDef(variableId: string, varDef: VarDef) {
  if (!hasProperty(varDef, 'id')) {
    throw new Error(`Variable ${varDef.name} is missing id property`);
  }
  if (varDef.id !== variableId) {
    throw new Error(
      `Variable key ${variableId} does not match id property ${varDef.id}`
    );
  }
  if (!hasProperty(varDef, 'name')) {
    throw new Error(`Variable ${varDef.id} is missing name property`);
  }
  if (!hasProperty(varDef, 'type')) {
    throw new Error(`Variable ${varDef.id} is missing type property`);
  }
  if (!hasProperty(varDef, 'defaultValue')) {
    throw new Error(`Variable ${varDef.id} is missing defaultValue property`);
  }
  if (
    hasProperty(varDef, 'scope') &&
    varDef.scope !== undefined &&
    varDef.scope !== null &&
    typeof varDef.scope !== 'string'
  ) {
    throw new Error(`Variable ${varDef.id} has invalid scope property`);
  }
}

function validateStateDef(stateDef: ArcscriptStateDef) {
  Object.entries(stateDef).forEach(([id, varDef]) => {
    validateVarDef(id, varDef);
  });
}

type OutputObject = {
  output?: string;
  index?: number;
  fromScript?: boolean;
  inBlockquote?: boolean;
  isScript: boolean;
};

export default class ArcscriptState {
  variables: Record<string, ArcscriptVariable>;

  elementVisits: Record<string, number>;
  currentElement: string;
  outputs: OutputObject[];
  conditionDepth: number;
  emit: (event: string, data?: unknown) => void;
  outputDoc: Document;
  rootElement: HTMLElement;
  inBlockquote: boolean;
  insertBlockquote: boolean;

  constructor(
    arcscriptVariables: ArcscriptStateDef,
    elementVisits: Record<string, number>,
    currentElement: string,
    emit: (event: string, data?: unknown) => void
  ) {
    this.variables = this.initializeVariables(arcscriptVariables);

    this.elementVisits = elementVisits;
    this.currentElement = currentElement;
    this.outputs = [];
    this.conditionDepth = 0;

    this.emit = emit;

    this.outputDoc = document.implementation.createHTMLDocument();
    this.rootElement = this.outputDoc.createElement('div');
    this.outputDoc.body.appendChild(this.rootElement);
    this.inBlockquote = false;
    this.insertBlockquote = false;
  }

  initializeVariables(arcscriptVariables: ArcscriptStateDef) {
    validateStateDef(arcscriptVariables);
    const variables: Record<string, ArcscriptVariable> = {};
    Object.entries(arcscriptVariables).forEach(([id, varDef]) => {
      variables[id] = new ArcscriptVariable({
        id,
        name: varDef.name,
        type: varDef.type,
        defaultValue: varDef.defaultValue,
        value: varDef.value,
        scope: varDef.scope,
      });
    });
    return variables;
  }

  getVar(name: string, scope: string | null = null): ArcscriptVariable {
    const variable = Object.values(this.variables).find(v => {
      if (scope) {
        return v.name === name && v.scope === scope;
      }
      return v.name === name;
    });
    if (!variable) {
      throw new Error(`Variable ${name} not found`);
    }
    return variable;
  }

  setVarValues(values: Record<string, VarValue>) {
    Object.entries(values).forEach(([id, value]) => {
      if (this.variables[id]) {
        this.variables[id].setValue(value);
      }
    });
  }

  getChanges() {
    const changes: Record<string, VarValue> = {};
    Object.entries(this.variables).forEach(
      ([id, variable]: [string, ArcscriptVariable]) => {
        if (variable.changed) {
          changes[id] = variable.getValue();
        }
      }
    );
    return changes;
  }

  /**
   * Adds an output to the array. The array has info on the current condition depth,
   * the type of the output pushed (blockquote or paragraph), and if comes from a script
   * (i.e. using 'show' function)
   * @param {string} output The output
   * @param {boolean} fromScript If the output comes from a script
   */
  pushOutput(output: string, fromScript: boolean = false) {
    let previousOutput = null;
    if (this.outputs.length > 0) {
      previousOutput = this.outputs[this.outputs.length - 1];
    }

    let outputNode = new DOMParser().parseFromString(output, 'text/html').body
      .firstElementChild;
    if (!outputNode) {
      return;
    }

    this.outputs.push({
      output,
      index: this.conditionDepth,
      fromScript,
      inBlockquote: this.inBlockquote,
      isScript: false,
    });

    // If this is the first output to be inserted
    if (!this.rootElement.innerHTML) {
      if (this.insertBlockquote) {
        const newNode = this.outputDoc.createElement('blockquote');
        newNode.appendChild(outputNode);
        outputNode = newNode;
        this.insertBlockquote = false;
      }
      this.rootElement.appendChild(outputNode);
    }
    // If current output is coming from a script, we are merging it with the previous output
    else if (fromScript) {
      if (this.insertBlockquote) {
        const newNode = this.outputDoc.createElement('blockquote');
        newNode.appendChild(outputNode);
        outputNode = newNode;
        this.insertBlockquote = false;
        this.rootElement.appendChild(outputNode);
      } else if (outputNode.innerHTML) {
        const children =
          this.outputDoc.body.querySelectorAll('div p:last-child');
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
      previousOutput &&
      (previousOutput.fromScript ||
        previousOutput.isScript ||
        previousOutput.index !== this.conditionDepth)
    ) {
      const nodeName = this.inBlockquote ? 'BLOCKQUOTE' : 'P';
      const previousNode = this.rootElement.lastElementChild;
      if (previousNode && previousNode.nodeName === nodeName) {
        if (outputNode.innerHTML) {
          const children =
            this.rootElement.querySelectorAll('div p:last-child');
          if (children[children.length - 1].innerHTML === '') {
            children[children.length - 1].innerHTML = outputNode.innerHTML;
          } else {
            children[children.length - 1].innerHTML +=
              ` ${outputNode.innerHTML}`;
          }
        }
      } else {
        if (this.insertBlockquote) {
          const newNode = this.outputDoc.createElement('blockquote');
          newNode.appendChild(outputNode);
          outputNode = newNode;
          this.insertBlockquote = false;
        }
        this.rootElement.appendChild(outputNode);
      }
    } else if (this.inBlockquote) {
      if (this.insertBlockquote) {
        const newNode = this.outputDoc.createElement('blockquote');
        newNode.appendChild(outputNode);
        this.rootElement.appendChild(newNode);

        this.insertBlockquote = false;
      } else {
        this.outputDoc
          .querySelector('blockquote:last-child')
          ?.appendChild(outputNode);
      }
    } else {
      this.rootElement.appendChild(outputNode);
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
  generateOutput(): string {
    return this.rootElement.innerHTML;
  }

  resetVisits() {
    Object.keys(this.elementVisits).forEach(key => {
      this.elementVisits[key] = 0;
    });
    this.emit('resetVisits', {});
  }
}
