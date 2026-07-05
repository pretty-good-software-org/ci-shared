const { describe, it } = require("node:test");
const assert = require("node:assert");

const main = require("../action.ts");
const { buildNpmrc } = main;

const captureWrite = () => {
  const calls: { content: string; path: string }[] = [];
  const write = (writePath: string, content: string) => {
    calls.push({ content, path: writePath });
  };
  return { calls, write };
};

const captureExportedVars = () => {
  const vars: Record<string, string> = {};
  const core = { exportVariable: (name: string, value: string) => (vars[name] = value) };
  return { core, vars };
};

describe("buildNpmrc", () => {
  it("maps the scope's registry to GitHub Packages", () => {
    const npmrc = buildNpmrc({ scope: "@acme", token: "tok" });
    assert.match(npmrc, /^@acme:registry=https:\/\/npm\.pkg\.github\.com$/m, "should map scope registry");
  });

  it("sets the auth token for the GitHub Packages registry", () => {
    const npmrc = buildNpmrc({ scope: "@acme", token: "secret-token" });
    assert.match(
      npmrc,
      /^\/\/npm\.pkg\.github\.com\/:_authToken=secret-token$/m,
      "should set _authToken for npm.pkg.github.com",
    );
  });
});

describe("main npmrc contents", () => {
  it("writes ~/.npmrc with the resolved scope and token", () => {
    const { calls, write } = captureWrite();
    const { core } = captureExportedVars();
    main({ core, env: { INPUT_SCOPE: "@acme", INPUT_TOKEN: "tok" }, write });

    assert.strictEqual(calls.length, 1, "should write exactly one file");
    assert.match(
      calls[0].content,
      /@acme:registry=https:\/\/npm\.pkg\.github\.com/,
      "npmrc should use configured scope",
    );
  });

  it("defaults scope to @pretty-good-software-org", () => {
    const { calls, write } = captureWrite();
    const { core } = captureExportedVars();
    main({ core, env: { INPUT_TOKEN: "tok" }, write });

    assert.match(
      calls[0].content,
      /@pretty-good-software-org:registry=https:\/\/npm\.pkg\.github\.com/,
      "should default to org scope",
    );
  });
});

describe("main token export", () => {
  it("exports NODE_AUTH_TOKEN via core.exportVariable", () => {
    const { write } = captureWrite();
    const { core, vars } = captureExportedVars();
    main({ core, env: { INPUT_TOKEN: "tok" }, write });

    assert.strictEqual(vars.NODE_AUTH_TOKEN, "tok", "should export the minted token as NODE_AUTH_TOKEN");
  });

  it("throws when INPUT_TOKEN is missing", () => {
    const { write } = captureWrite();
    const { core } = captureExportedVars();
    assert.throws(
      () => main({ core, env: {}, write }),
      /INPUT_TOKEN is required/,
      "should throw when the app-token step did not produce a token",
    );
  });
});
