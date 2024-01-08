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
  runScript(code: string): object;
  parse(code: string): object;
  replaceVariables(code: string, variables: object): string;
}
