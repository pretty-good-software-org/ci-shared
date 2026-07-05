// Configure npm auth for private GitHub Packages using a GitHub App installation token.
//
// Writes ~/.npmrc mapping the given scope's registry to npm.pkg.github.com.
// Also exports NODE_AUTH_TOKEN for install steps (e.g. bun install, npm ci) that read the token from the environment.

const { writeFileSync } = require("node:fs");
const { homedir } = require("node:os");
const path = require("node:path");

type WriteFn = typeof writeFileSync;

interface CoreExport {
  exportVariable: (name: string, value: string) => void;
}

interface RunArgs {
  scope: string;
  token: string;
}

const buildNpmrc = ({ scope, token }: RunArgs): string =>
  [`${scope}:registry=https://npm.pkg.github.com`, `//npm.pkg.github.com/:_authToken=${token}`, ""].join("\n");

const run = (
  args: RunArgs,
  write: WriteFn = writeFileSync,
  npmrcPath: string = path.join(homedir(), ".npmrc"),
): void => {
  write(npmrcPath, buildNpmrc(args));
};

const resolveToken = (env: NodeJS.ProcessEnv): string => {
  const token = env.INPUT_TOKEN || "";
  if (!token) {
    throw new Error("INPUT_TOKEN is required — did the create-github-app-token step run?");
  }
  return token;
};

const main = ({
  core,
  env = process.env,
  write = writeFileSync,
}: {
  core: CoreExport;
  env?: NodeJS.ProcessEnv;
  write?: WriteFn;
}): void => {
  const scope = env.INPUT_SCOPE || "@pretty-good-software-org";
  const token = resolveToken(env);
  run({ scope, token }, write);
  core.exportVariable("NODE_AUTH_TOKEN", token);
};

module.exports = Object.assign(main, { buildNpmrc, run });
