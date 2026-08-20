import { ArcscriptStateDef, VarDef, VarValue } from './types.js';
import ArcscriptVariable from './ArcscriptVariable.js';
import { isGlobalScope } from './scope.js';

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
  if (
    !hasProperty(varDef, 'defaultValue') ||
    varDef.defaultValue === undefined
  ) {
    throw new Error(`Variable ${varDef.id} is missing defaultValue property`);
  }
  if (varDef.defaultValue === null) {
    throw new Error(`Variable ${varDef.id} has null defaultValue property`);
  }
  if (hasProperty(varDef, 'value') && varDef.value === null) {
    throw new Error(`Variable ${varDef.id} has null value property`);
  }
  if (
    hasProperty(varDef, 'scope') &&
    varDef.scope !== undefined &&
    varDef.scope !== null &&
    typeof varDef.scope !== 'string'
  ) {
    throw new Error(`Variable ${varDef.id} has invalid scope property`);
  }
  if (varDef.scope === '') {
    throw new Error(`Variable ${varDef.id} has empty scope property`);
  }
}

function validateStateDef(stateDef: ArcscriptStateDef) {
  Object.entries(stateDef).forEach(([id, varDef]) => {
    validateVarDef(id, varDef);
  });
}

type OutputEntry =
  | { isScript: true }
  | { isScript: false; conditionDepth: number; fromScript: boolean };

export default class ArcscriptState {
  private readonly variables: Record<string, ArcscriptVariable>;
  private readonly elementVisits: Record<string, number>;
  private readonly currentElement: string;
  private readonly outputs: OutputEntry[];
  private conditionDepth: number;
  private readonly emit: (event: string, data?: unknown) => void;
  private readonly outputDoc: Document;
  private readonly rootElement: HTMLElement;
  private inBlockquote: boolean;
  private insertBlockquote: boolean;

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

  private initializeVariables(arcscriptVariables: ArcscriptStateDef) {
    validateStateDef(arcscriptVariables);
    const variables = Object.create(null) as Record<string, ArcscriptVariable>;
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
      if (scope !== null) {
        return v.name === name && v.scope === scope;
      }
      return v.name === name && isGlobalScope(v.scope);
    });
    if (!variable) {
      throw new Error(`Variable ${name} not found`);
    }
    return variable;
  }

  resetVariablesExcept(excludedIds: ReadonlySet<string>): void {
    Object.values(this.variables).forEach(variable => {
      if (!excludedIds.has(variable.id)) {
        variable.reset();
      }
    });
  }

  getCurrentElementVisitCount(): number {
    return this.getElementVisitCount(this.currentElement) ?? 0;
  }

  getElementVisitCount(elementId: string): number | undefined {
    if (!hasProperty(this.elementVisits, elementId)) {
      return undefined;
    }
    return this.elementVisits[elementId];
  }

  setVarValues(values: Record<string, VarValue>) {
    Object.entries(values).forEach(([id, value]) => {
      if (hasProperty(this.variables, id)) {
        this.variables[id].setValue(value);
      }
    });
  }

  getChanges() {
    return Object.fromEntries(
      Object.entries(this.variables)
        .filter(([, variable]) => variable.hasChanged())
        .map(([id, variable]) => [id, variable.getValue()])
    ) as Record<string, VarValue>;
  }

  /** Adds rendered output and records metadata used for subsequent merging. */
  pushOutput(output: string, fromScript: boolean = false) {
    const previousOutput = this.outputs[this.outputs.length - 1];
    const outputNode = this.parseOutputNode(output);
    if (!outputNode) {
      return;
    }

    this.recordOutput(fromScript);

    // If this is the first output to be inserted
    if (!this.rootElement.innerHTML) {
      this.appendToRoot(outputNode);
    }
    // If current output is coming from a script, we are merging it with the previous output
    else if (fromScript) {
      this.appendScriptOutput(outputNode);
    }
    // If the previous output was from a script, the node was a script or
    // the condition depth is different, merge if the nodes are of the same type
    else if (this.shouldMergeWithPreviousOutput(previousOutput)) {
      this.appendAfterPreviousOutput(outputNode);
    } else if (this.inBlockquote) {
      this.appendBlockquoteOutput(outputNode);
    } else {
      this.rootElement.appendChild(outputNode);
    }

    this.insertBlockquote = false;
  }

  /** Records a script boundary used when merging subsequent output. */
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

  private parseOutputNode(output: string): Element | null {
    return new DOMParser().parseFromString(output, 'text/html').body
      .firstElementChild;
  }

  private recordOutput(fromScript: boolean): void {
    this.outputs.push({
      conditionDepth: this.conditionDepth,
      fromScript,
      isScript: false,
    });
  }

  private appendToRoot(outputNode: Element): void {
    this.rootElement.appendChild(this.wrapInBlockquote(outputNode));
  }

  private wrapInBlockquote(outputNode: Element): Element {
    if (!this.insertBlockquote) {
      return outputNode;
    }
    const blockquote = this.outputDoc.createElement('blockquote');
    blockquote.appendChild(outputNode);
    return blockquote;
  }

  private appendScriptOutput(outputNode: Element): void {
    if (this.insertBlockquote) {
      this.appendToRoot(outputNode);
      return;
    }
    this.mergeWithLastParagraph(outputNode, this.outputDoc.body);
  }

  private shouldMergeWithPreviousOutput(
    previousOutput: OutputEntry | undefined
  ): boolean {
    if (!previousOutput) {
      return false;
    }
    if (previousOutput.isScript) {
      return true;
    }
    return (
      previousOutput.fromScript ||
      previousOutput.conditionDepth !== this.conditionDepth
    );
  }

  private appendAfterPreviousOutput(outputNode: Element): void {
    const expectedNodeName = this.inBlockquote ? 'BLOCKQUOTE' : 'P';
    const previousNode = this.rootElement.lastElementChild;
    if (previousNode?.nodeName === expectedNodeName) {
      this.mergeWithLastParagraph(outputNode, this.rootElement);
      return;
    }
    this.appendToRoot(outputNode);
  }

  private mergeWithLastParagraph(
    outputNode: Element,
    container: ParentNode
  ): void {
    if (!outputNode.innerHTML) {
      return;
    }
    const paragraphs = container.querySelectorAll('div p:last-child');
    const lastParagraph = paragraphs[paragraphs.length - 1];
    if (lastParagraph.innerHTML === '') {
      lastParagraph.innerHTML = outputNode.innerHTML;
    } else {
      lastParagraph.innerHTML += ` ${outputNode.innerHTML}`;
    }
  }

  private appendBlockquoteOutput(outputNode: Element): void {
    if (this.insertBlockquote) {
      this.appendToRoot(outputNode);
      return;
    }
    this.outputDoc
      .querySelector('blockquote:last-child')
      ?.appendChild(outputNode);
  }
}
