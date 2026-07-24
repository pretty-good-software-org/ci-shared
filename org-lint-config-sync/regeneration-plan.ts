import type { OrgLintConfigPin } from "./pin-types.ts";

export interface ExtractedFile {
  extractedSha256: string;
  vendoredPath: string;
}

export interface RegenerationFailure {
  actualSha256: string;
  expectedSha256: string;
  reason: "archive-mismatch" | "file-mismatch" | "unpinned-file";
  vendoredPath?: string;
}

const UNPINNED = "(unpinned)";

const verifyExtractedFile = (pin: OrgLintConfigPin, file: ExtractedFile): RegenerationFailure | undefined => {
  const expectedSha256 = pin.vendoredFiles[file.vendoredPath]?.sha256;
  if (expectedSha256 === undefined) {
    return {
      actualSha256: file.extractedSha256,
      expectedSha256: UNPINNED,
      reason: "unpinned-file",
      vendoredPath: file.vendoredPath,
    };
  }
  if (expectedSha256 !== file.extractedSha256) {
    return {
      actualSha256: file.extractedSha256,
      expectedSha256,
      reason: "file-mismatch",
      vendoredPath: file.vendoredPath,
    };
  }
  return undefined;
};

// Never trusts per-file hashes from an archive that already failed its own verification —
// A mismatched archive digest means the download is unverified end to end, so per-file
// Checks would be checking bytes we have no basis to trust in the first place.
const planRegeneration = (
  pin: OrgLintConfigPin,
  downloadedArchiveSha256: string,
  extractedFiles: ExtractedFile[],
): RegenerationFailure[] => {
  if (downloadedArchiveSha256 !== pin.archiveSha256) {
    return [{ actualSha256: downloadedArchiveSha256, expectedSha256: pin.archiveSha256, reason: "archive-mismatch" }];
  }
  return extractedFiles
    .map((file) => verifyExtractedFile(pin, file))
    .filter((failure): failure is RegenerationFailure => failure !== undefined);
};

const describeRegenerationFailure = (failure: RegenerationFailure): string => {
  if (failure.reason === "archive-mismatch") {
    return `archive: SHA-256 mismatch — pinned ${failure.expectedSha256}, downloaded ${failure.actualSha256}`;
  }
  if (failure.reason === "unpinned-file") {
    return `${failure.vendoredPath}: no pin entry in .org-lint-config.json`;
  }
  return `${failure.vendoredPath}: SHA-256 mismatch — pinned ${failure.expectedSha256}, extracted ${failure.actualSha256}`;
};

module.exports = { describeRegenerationFailure, planRegeneration };
