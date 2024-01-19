export declare class Interpreter {
  varValues: object;
  varObjects: object;
  elementVisits: object;
  currentElement: string;

  constructor(
    varValues: object,
    varObjects: object,
    elementVisits: object,
    currentElement: string
  );
  runScript(code: string, varValues?: object): object;
  parse(code: string): object;
  replaceVariables(code: string, variables: object): string;
}
