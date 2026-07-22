import type { FetchFn, ReleaseAsset, ReleaseResponse } from "./action-types.ts";

const ORGANIZATION = "pretty-good-software-org";
const REPOSITORY = "org-lint-config";
const API_ROOT = `https://api.github.com/repos/${ORGANIZATION}/${REPOSITORY}`;
const BYTES_PER_KIBIBYTE = 1024;
const MAX_ARCHIVE_MEBIBYTES = 50;
const MAX_ARCHIVE_BYTES = MAX_ARCHIVE_MEBIBYTES * BYTES_PER_KIBIBYTE * BYTES_PER_KIBIBYTE;
const API_VERSION = "2022-11-28";

const requestHeaders = (token: string, accept: string): HeadersInit => ({
  Accept: accept,
  Authorization: `Bearer ${token}`,
  "X-GitHub-Api-Version": API_VERSION,
});

const requireSuccessfulResponse = (response: Response, operation: string): void => {
  if (!response.ok) {
    throw new Error(`${operation} failed with GitHub status ${response.status}`);
  }
};

const parseRelease = async (response: Response): Promise<ReleaseResponse> => {
  try {
    return (await response.json()) as ReleaseResponse;
  } catch (error: unknown) {
    throw new Error("parse private release metadata: GitHub returned invalid JSON", { cause: error });
  }
};

const validateRelease = (release: ReleaseResponse, version: string): void => {
  if (release.draft || release.tag_name !== version) {
    throw new Error(`resolve private release ${version}: GitHub returned a different or draft release`);
  }
  if (!Array.isArray(release.assets)) {
    throw new Error(`resolve private release ${version}: GitHub returned an invalid asset list`);
  }
};

const findArchiveAsset = (release: ReleaseResponse, version: string): ReleaseAsset => {
  validateRelease(release, version);
  const expectedName = `${REPOSITORY}-${version}.tar.gz`;
  const matches = release.assets.filter((asset) => asset.name === expectedName);
  if (matches.length !== 1) {
    throw new Error(`resolve private release ${version}: expected exactly one ${expectedName} asset`);
  }
  if (!matches[0].url.startsWith(`${API_ROOT}/releases/assets/`)) {
    throw new Error(`resolve private release ${version}: archive asset URL is outside the repository API`);
  }
  return matches[0];
};

const declaredContentLength = (response: Response): number => Number(response.headers.get("content-length") || "0");

const enforceDeclaredArchiveSize = (response: Response): number => {
  const declaredLength = declaredContentLength(response);
  if (declaredLength > MAX_ARCHIVE_BYTES) {
    throw new Error(`download private release archive: asset exceeds ${MAX_ARCHIVE_BYTES} bytes`);
  }
  return declaredLength;
};

const appendChunk = (chunks: Buffer[], byteLength: number, chunk: Uint8Array): number => {
  const nextByteLength = byteLength + chunk.byteLength;
  if (nextByteLength > MAX_ARCHIVE_BYTES) {
    throw new Error(`download private release archive: asset exceeds ${MAX_ARCHIVE_BYTES} bytes`);
  }
  chunks.push(Buffer.from(chunk));
  return nextByteLength;
};

const readArchiveBody = async (response: Response): Promise<Buffer> => {
  const declaredLength = enforceDeclaredArchiveSize(response);
  if (!response.body) {
    throw new Error("download private release archive: response body is unavailable");
  }
  const chunks: Buffer[] = [];
  let byteLength = 0;
  for await (const chunk of response.body) {
    byteLength = appendChunk(chunks, byteLength, chunk);
  }
  if (declaredLength && declaredLength !== byteLength) {
    throw new Error("download private release archive: response body is incomplete");
  }
  return Buffer.concat(chunks, byteLength);
};

const downloadReleaseArchive = async (version: string, token: string, fetchFn: FetchFn = fetch): Promise<Buffer> => {
  const releaseUrl = `${API_ROOT}/releases/tags/${encodeURIComponent(version)}`;
  const releaseResponse = await fetchFn(releaseUrl, {
    headers: requestHeaders(token, "application/vnd.github+json"),
  });
  requireSuccessfulResponse(releaseResponse, `read private release ${version}`);
  const release = await parseRelease(releaseResponse);
  const asset = findArchiveAsset(release, version);

  const assetResponse = await fetchFn(asset.url, {
    headers: requestHeaders(token, "application/octet-stream"),
    redirect: "follow",
  });
  requireSuccessfulResponse(assetResponse, `download private release ${version}`);
  return readArchiveBody(assetResponse);
};

module.exports = { downloadReleaseArchive };
