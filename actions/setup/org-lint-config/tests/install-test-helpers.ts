const { createHash } = require("node:crypto");
const { mkdtempSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");

import type { TestContext } from "node:test";

const main = require("../action.ts");

const VERSION = "v1.0.0";
const ASSET_API_URL = "https://api.github.com/repos/pretty-good-software-org/org-lint-config/releases/assets/123";
const RELEASE_API_URL = "https://api.github.com/repos/pretty-good-software-org/org-lint-config/releases/tags/v1.0.0";

interface RequestRecord {
  headers: Headers;
  url: string;
}

const digest = (archive: Buffer): string => createHash("sha256").update(archive).digest("hex");

const actionEnvironment = (outputDirectory: string, archive: Buffer): NodeJS.ProcessEnv => ({
  INPUT_OUTPUT_DIRECTORY: outputDirectory,
  INPUT_SHA256: digest(archive),
  INPUT_TOKEN: "secret-installation-token",
  INPUT_VERSION: VERSION,
});

const releaseResponse = (): Response =>
  Response.json({
    assets: [
      { name: "org-lint-config-v1.0.0.tar.gz.sha256", url: `${ASSET_API_URL}4` },
      { name: "org-lint-config-v1.0.0.tar.gz", url: ASSET_API_URL },
    ],
    draft: false,
    tag_name: VERSION,
  });

const archiveResponse = (archive: Buffer): Response => {
  const headers = { "content-length": String(archive.length) };
  return new Response(new Uint8Array(archive), { headers });
};

const responseFor = (url: string, archive: Buffer): Response => {
  if (url === RELEASE_API_URL) {
    return releaseResponse();
  }
  if (url === ASSET_API_URL) {
    return archiveResponse(archive);
  }
  return new Response("not found", { status: 404 });
};

const mockGitHub = (archive: Buffer): { fetchFn: typeof fetch; requests: RequestRecord[] } => {
  const requests: RequestRecord[] = [];
  const fetchFn = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    requests.push({ headers: new Headers(init?.headers), url });
    return responseFor(url, archive);
  };
  return { fetchFn, requests };
};

const temporaryDirectory = (context: TestContext): string => {
  const directory = mkdtempSync(path.join(tmpdir(), "org-lint-config-test-"));
  context.after(() => rmSync(directory, { force: true, recursive: true }));
  return directory;
};

const runAction = async (outputDirectory: string, archive: Buffer, sha256 = digest(archive)) => {
  const { fetchFn, requests } = mockGitHub(archive);
  const outputs: Record<string, string> = {};
  const env = { ...actionEnvironment(outputDirectory, archive), INPUT_SHA256: sha256 };
  const writeOutput = (name: string, value: string): void => {
    outputs[name] = value;
  };
  await main({ env, fetchFn, writeOutput });
  return { outputs, requests };
};

module.exports = { ASSET_API_URL, RELEASE_API_URL, runAction, temporaryDirectory };
