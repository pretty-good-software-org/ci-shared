const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const { downloadReleaseArchive } = require("../download-release.ts");

const ASSET_API_URL = "https://api.github.com/repos/pretty-good-software-org/org-lint-config/releases/assets/123";
const BYTES_PER_KIBIBYTE = 1024;
const MAX_ARCHIVE_MEBIBYTES = 50;
const EXTRA_CHUNKS_AFTER_LIMIT = 2;
const OVERSIZED_CHUNK_COUNT = MAX_ARCHIVE_MEBIBYTES + EXTRA_CHUNKS_AFTER_LIMIT;

const releaseResponse = (): Response =>
  Response.json({
    assets: [{ name: "org-lint-config-v1.0.0.tar.gz", url: ASSET_API_URL }],
    draft: false,
    tag_name: "v1.0.0",
  });

const fetchForAsset = (assetResponse: Response): typeof fetch => {
  let requestCount = 0;
  return async (): Promise<Response> => {
    requestCount += 1;
    if (requestCount === 1) {
      return releaseResponse();
    }
    return assetResponse;
  };
};

describe("private release archive streaming", () => {
  it("consumes the response stream without calling arrayBuffer", async () => {
    const assetResponse = new Response("archive");
    Object.defineProperty(assetResponse, "arrayBuffer", {
      value: () => Promise.reject(new Error("arrayBuffer must not be called")),
    });

    const archive = await downloadReleaseArchive("v1.0.0", "token", fetchForAsset(assetResponse));

    assert.strictEqual(archive.toString("utf8"), "archive", "streamed archive must contain the complete response body");
  });
});

describe("private release archive size limit", () => {
  it("cancels a dishonest oversized response when it reaches the limit", async () => {
    const chunk = new Uint8Array(BYTES_PER_KIBIBYTE * BYTES_PER_KIBIBYTE);
    let chunksSent = 0;
    let cancelled = false;
    const body = new ReadableStream({
      cancel: () => {
        cancelled = true;
      },
      pull: (controller) => {
        if (chunksSent === OVERSIZED_CHUNK_COUNT) {
          controller.close();
          return;
        }
        controller.enqueue(chunk);
        chunksSent += 1;
      },
    });

    await assert.rejects(
      downloadReleaseArchive("v1.0.0", "token", fetchForAsset(new Response(body))),
      /asset exceeds/,
      "streamed body must stop at the archive size limit",
    );

    assert.strictEqual(cancelled, true, "reader must cancel the oversized response stream");
  });
});

describe("private release archive body requirement", () => {
  it("rejects an unavailable response body", async () => {
    const assetResponse = new Response(undefined, { status: 200 });

    await assert.rejects(
      downloadReleaseArchive("v1.0.0", "token", fetchForAsset(assetResponse)),
      /response body is unavailable/,
      "missing archive body must fail closed",
    );
  });
});
