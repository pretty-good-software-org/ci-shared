import type { AuthFixture } from "./git-auth-helpers";

const { it } = require("node:test");
const assert = require("node:assert");
const { withAuthFixture } = require("./git-auth-helpers.ts");

const REALISTIC_APP_TOKEN_BODY_LENGTH = 250;
const LONG_APP_TOKEN = `ghs_${"A".repeat(REALISTIC_APP_TOKEN_BODY_LENGTH)}`;
const EXPECTED_LONG_APP_HEADER =
  "AUTHORIZATION: basic eC1hY2Nlc3MtdG9rZW46Z2hzX0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUE=";
const VALID_CHECKOUT_HEADER = "AUTHORIZATION: basic eC1hY2Nlc3MtdG9rZW46Z2hzX2ZhbGxiYWNr";
const INVALID_CHECKOUT_HEADER_ERROR = "Expected at most one well-formed checkout Basic Authorization header\n";

const assertRejectedFallback = (fixture: AuthFixture, statusMessage: string, outputMessage: string): void => {
  const result = fixture.run("");
  assert.strictEqual(result.status, 1, statusMessage);
  assert.strictEqual(`${result.stdout}${result.stderr}`, INVALID_CHECKOUT_HEADER_ERROR, outputMessage);
};

it("writes one unwrapped header for a realistic long GitHub App token", () => {
  withAuthFixture((fixture: AuthFixture) => {
    fixture.addGlobalHeader("AUTHORIZATION: basic malformed-one");
    fixture.addGlobalHeader("AUTHORIZATION: basic malformed-two");
    fixture.addLocalHeader("AUTHORIZATION: basic malformed-fallback");

    const result = fixture.run(LONG_APP_TOKEN);

    assert.strictEqual(result.status, 0, "a long GitHub App token should configure Git successfully");
    assert.deepStrictEqual(
      fixture.globalHeaders(),
      [EXPECTED_LONG_APP_HEADER],
      "App authentication should replace old values with one complete single-line header",
    );
  });
});

it("copies one valid checkout header and replaces old global values", () => {
  withAuthFixture((fixture: AuthFixture) => {
    fixture.addGlobalHeader("AUTHORIZATION: basic malformed-one");
    fixture.addGlobalHeader("AUTHORIZATION: basic malformed-two");
    fixture.addLocalHeader(VALID_CHECKOUT_HEADER);

    const result = fixture.run("");

    assert.strictEqual(result.status, 0, "one valid checkout header should be accepted");
    assert.deepStrictEqual(
      fixture.globalHeaders(),
      [VALID_CHECKOUT_HEADER],
      "the checkout fallback should leave exactly one global Authorization value",
    );
  });
});

it("leaves authentication unset when checkout has no header", () => {
  withAuthFixture((fixture: AuthFixture) => {
    const result = fixture.run("");

    assert.strictEqual(result.status, 0, "a public policy repository should not require an auth header");
    assert.deepStrictEqual(fixture.globalHeaders(), [], "an absent checkout header should not create empty auth");
  });
});

it("fails closed on a wrapped checkout header", () => {
  withAuthFixture((fixture: AuthFixture) => {
    fixture.addLocalHeader("AUTHORIZATION: basic abcdef\nwrapped");

    assertRejectedFallback(
      fixture,
      "a multiline Authorization value should be rejected",
      "the failure should explain the contract without logging the header",
    );
  });
});

it("fails closed on multiple checkout headers", () => {
  withAuthFixture((fixture: AuthFixture) => {
    fixture.addLocalHeader("AUTHORIZATION: basic malformed-one");
    fixture.addLocalHeader("AUTHORIZATION: basic malformed-two");

    assertRejectedFallback(
      fixture,
      "multiple Authorization values should be rejected as ambiguous",
      "the failure should not reveal either malformed header",
    );
  });
});

it("fails closed on a malformed checkout header", () => {
  withAuthFixture((fixture: AuthFixture) => {
    fixture.addLocalHeader("AUTHORIZATION: bearer malformed-token");

    assertRejectedFallback(
      fixture,
      "a non-Basic checkout Authorization value should be rejected",
      "the failure should not reveal the malformed header",
    );
  });
});
