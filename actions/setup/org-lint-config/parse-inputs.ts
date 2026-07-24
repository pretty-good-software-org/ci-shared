import type { InstallerInputs } from "./action-types.ts";

const VERSION_PATTERN = /^v\d+\.\d+\.\d+$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;

const requiredInput = (env: NodeJS.ProcessEnv, name: string): string => {
  const value = env[name] || "";
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

const parseInputs = (env: NodeJS.ProcessEnv): InstallerInputs => {
  const version = requiredInput(env, "INPUT_VERSION");
  if (!VERSION_PATTERN.test(version)) {
    throw new Error("INPUT_VERSION must be an exact release tag in v1.0.0 form");
  }

  const sha256 = requiredInput(env, "INPUT_SHA256");
  if (!SHA256_PATTERN.test(sha256)) {
    throw new Error("INPUT_SHA256 must be exactly 64 lowercase hexadecimal characters");
  }

  return {
    outputDirectory: requiredInput(env, "INPUT_OUTPUT_DIRECTORY"),
    sha256,
    token: requiredInput(env, "INPUT_TOKEN"),
    version,
  };
};

module.exports = { parseInputs };
