export interface InstallerInputs {
  outputDirectory: string;
  sha256: string;
  token: string;
  version: string;
}

export interface ReleaseAsset {
  name: string;
  url: string;
}

export interface ReleaseResponse {
  assets: ReleaseAsset[];
  draft: boolean;
  tag_name: string;
}

export type FetchFn = (input: string | URL | globalThis.Request, init?: RequestInit) => Promise<Response>;
export type OutputWriter = (name: string, value: string) => void;
