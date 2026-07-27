export interface LiveFixture {
  checkout: string;
  directorySource: string;
  gitSource: string;
  root: string;
}

export interface LiveOutputs {
  outputs: Record<string, string>;
  rejection: string;
}
