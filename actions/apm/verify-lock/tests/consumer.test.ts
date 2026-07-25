const { afterEach, describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { cleanTemporaryDirectories, createFixture } = require("./fixture.ts");
const { verifyFixtureWithPiProjection, verifyFixtureWithoutDocReadme } = require("./harness.ts");

afterEach(cleanTemporaryDirectories);

describe("isolated doc-update-project consumer", () => {
  it("rejects a missing transitive documentation specialist", () => {
    const fixture = createFixture();
    const result = verifyFixtureWithoutDocReadme(fixture);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /doc-update-project consumer installed the wrong skills/);
    assert.match(result.stderr, /doc-agents-md.*doc-changelog.*doc-update-project/s);
  });

  it("rejects a duplicate Pi-specific skill projection", () => {
    const fixture = createFixture();
    const result = verifyFixtureWithPiProjection(fixture);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /doc-update-project consumer created a duplicate \.pi\/skills projection/);
  });
});
