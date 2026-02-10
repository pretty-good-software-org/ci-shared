// Shared test mocks for action tests.
//
// Reusable mock factories so each test file doesn't
// Redefine the same capture/mock patterns.

const mockExec = (responses: Record<string, string> = {}, fallback = "") => {
  const commands: string[] = [];
  const exec = (bin: string, args: string[]): string => {
    const cmd = [bin, ...args].join(" ");
    commands.push(cmd);
    for (const [pattern, response] of Object.entries(responses)) {
      if (cmd.includes(pattern)) {
        return response;
      }
    }
    return fallback;
  };
  return { commands, exec };
};

const captureCommands = () => {
  const commands: string[] = [];
  const exec = (bin: string, args: string[]) => {
    commands.push([bin, ...args].join(" "));
  };
  return { commands, exec };
};

const captureOutputs = () => {
  const outputs: Record<string, string> = {};
  const writeOutput = (name: string, value: string) => {
    outputs[name] = value;
  };
  return { outputs, writeOutput };
};

const noopExec = (_bin: string, _args: string[]) => "";
const noopWrite = (..._args: unknown[]) => {};

module.exports = { captureCommands, captureOutputs, mockExec, noopExec, noopWrite };
