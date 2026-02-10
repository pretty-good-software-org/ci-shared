const { describe, it } = require("node:test");
const assert = require("node:assert");

const mise = require("../action.ts");
const { run } = mise;

const throwExec = (_bin: string, _args: string[], _env?: NodeJS.ProcessEnv) => {
  throw new Error("mise failed");
};

describe("run command", () => {
  it("executes 'mise install'", () => {
    const calls: { cmd: string; env?: NodeJS.ProcessEnv }[] = [];
    run({ miseEnv: "" }, (bin: string, args: string[], env?: NodeJS.ProcessEnv) =>
      calls.push({ cmd: [bin, ...args].join(" "), env }),
    );

    assert.strictEqual(calls.length, 1, "should execute exactly one command");
    assert.strictEqual(calls[0].cmd, "mise install", "command should be 'mise install'");
  });

  it("does not set MISE_ENV when miseEnv is empty", () => {
    const calls: { cmd: string; env?: NodeJS.ProcessEnv }[] = [];
    run({ miseEnv: "" }, (bin: string, args: string[], env?: NodeJS.ProcessEnv) =>
      calls.push({ cmd: [bin, ...args].join(" "), env }),
    );

    assert.strictEqual(calls[0].env, undefined, "env should be undefined when miseEnv is empty");
  });

  it("sets MISE_ENV when miseEnv is provided", () => {
    const calls: { cmd: string; env?: NodeJS.ProcessEnv }[] = [];
    run({ miseEnv: "ci" }, (bin: string, args: string[], env?: NodeJS.ProcessEnv) =>
      calls.push({ cmd: [bin, ...args].join(" "), env }),
    );

    assert.strictEqual(calls[0].env?.MISE_ENV, "ci", "MISE_ENV should be set to 'ci'");
  });
});

describe("main env parsing", () => {
  it("defaults miseEnv to empty when INPUT_MISE_ENV is not set", () => {
    const calls: { cmd: string; env?: NodeJS.ProcessEnv }[] = [];
    mise({
      env: {},
      exec: (bin: string, args: string[], env?: NodeJS.ProcessEnv) =>
        calls.push({ cmd: [bin, ...args].join(" "), env }),
    });

    assert.strictEqual(calls[0].env, undefined, "env should be undefined when no INPUT_MISE_ENV");
  });

  it("passes INPUT_MISE_ENV as miseEnv", () => {
    const calls: { cmd: string; env?: NodeJS.ProcessEnv }[] = [];
    mise({
      env: { INPUT_MISE_ENV: "production" },
      exec: (bin: string, args: string[], env?: NodeJS.ProcessEnv) =>
        calls.push({ cmd: [bin, ...args].join(" "), env }),
    });

    assert.strictEqual(calls[0].env?.MISE_ENV, "production", "MISE_ENV should match INPUT_MISE_ENV");
  });
});

// Snapshot: full command with defaults
describe("snapshot", () => {
  it("matches expected command with empty env", () => {
    const calls: { cmd: string; env?: NodeJS.ProcessEnv }[] = [];
    mise({
      env: {},
      exec: (bin: string, args: string[], env?: NodeJS.ProcessEnv) =>
        calls.push({ cmd: [bin, ...args].join(" "), env }),
    });

    assert.deepStrictEqual(calls, [{ cmd: "mise install", env: undefined }]);
  });
});

describe("error handling", () => {
  it("propagates exec failure", () => {
    assert.throws(() => run({ miseEnv: "" }, throwExec), { message: "mise failed" });
  });
  it("propagates exec failure with env", () => {
    assert.throws(() => run({ miseEnv: "ci" }, throwExec), { message: "mise failed" });
  });
});
