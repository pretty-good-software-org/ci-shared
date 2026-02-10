// GitHub Actions output writer.
//
// Writes step outputs via the GITHUB_OUTPUT file mechanism.
// Supports injecting core.setOutput or a custom writer in tests.

const { appendFileSync } = require("node:fs");
const { randomUUID } = require("node:crypto");

type OutputWriter = (name: string, value: string) => void;

interface CoreOutput {
  setOutput: (name: string, value: string) => void;
}

interface OutputWriterArgs {
  core?: CoreOutput;
  writeOutput?: OutputWriter;
}

const writeGitHubOutput: OutputWriter = (name, value) => {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) {
    throw new Error("GITHUB_OUTPUT is not set — cannot write output");
  }
  const delimiter = `ghadelimiter_${randomUUID()}`;
  appendFileSync(outputFile, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
};

const resolveOutputWriter = ({ core, writeOutput }: OutputWriterArgs): OutputWriter => {
  if (writeOutput) {
    return writeOutput;
  }
  if (core) {
    return (name: string, value: string) => core.setOutput(name, value);
  }
  return writeGitHubOutput;
};

module.exports = { resolveOutputWriter, writeGitHubOutput };
