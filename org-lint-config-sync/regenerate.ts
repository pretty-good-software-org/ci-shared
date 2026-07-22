// ROAD SIGN: See org-lint-config-sync/verify.ts for the fork-safe half of this
// Contract. This script is the network-touching half: it re-fetches the
// Pinned private org-lint-config release with `gh` (must already be
// Authenticated against pretty-good-software-org/org-lint-config), re-verifies
// Both the archive and per-file SHA-256 pins from `.org-lint-config.json`, and
// Only then overwrites the vendored files. Run manually — never wire this into
// CI, since it requires network access and repository credentials that public
// PR CI must not have.

const { createHash } = require("node:crypto");
const { mkdtempSync, readFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");

import type { ExtractedFile } from "./regeneration-plan.ts";
import type { OrgLintConfigPin } from "./pin-types.ts";
import type { AtomicWrite } from "./publish.ts";

const { loadPin } = require("./pin.ts");
const { describeRegenerationFailure, planRegeneration } = require("./regeneration-plan.ts");
const { atomicWrite, publishVendoredFiles } = require("./publish.ts");
const { resolveWithinRoot } = require("./safe-path.ts");
const { execStream } = require("../lib/exec.ts");

const REPOSITORY = "pretty-good-software-org/org-lint-config";

export type Exec = (bin: string, args: string[]) => void;

interface RegenerateSession {
  exec: Exec;
  pin: OrgLintConfigPin;
  workdir: string;
  write: AtomicWrite;
}

const sha256Of = (filePath: string): string => createHash("sha256").update(readFileSync(filePath)).digest("hex");

const downloadArchive = (version: string, workdir: string, exec: Exec): string => {
  const archiveName = `org-lint-config-${version}.tar.gz`;
  exec("gh", [
    "release",
    "download",
    version,
    "--repo",
    REPOSITORY,
    "--pattern",
    archiveName,
    "--dir",
    workdir,
    "--clobber",
  ]);
  return path.join(workdir, archiveName);
};

const extractArchive = (archivePath: string, workdir: string, exec: Exec): void => {
  exec("tar", ["xzf", archivePath, "-C", workdir]);
};

const readExtractedFiles = (pin: OrgLintConfigPin, extractedRoot: string): ExtractedFile[] =>
  Object.entries(pin.vendoredFiles).map(([vendoredPath, entry]) => ({
    extractedSha256: sha256Of(resolveWithinRoot("read extracted file", extractedRoot, entry.sourcePath)),
    vendoredPath,
  }));

const rejectIfPlanFails = (pin: OrgLintConfigPin, archiveSha256: string, extractedFiles: ExtractedFile[]): void => {
  const failures = planRegeneration(pin, archiveSha256, extractedFiles);
  if (failures.length === 0) {
    return;
  }
  const details = failures.map(describeRegenerationFailure).join("; ");
  throw new Error(`regenerate org-lint-config ${pin.version}: ${details}`);
};

const performRegenerate = (projectRoot: string, session: RegenerateSession): string[] => {
  const { exec, pin, workdir, write } = session;
  const archivePath = downloadArchive(pin.version, workdir, exec);
  const archiveSha256 = sha256Of(archivePath);
  extractArchive(archivePath, workdir, exec);
  const extractedRoot = path.join(workdir, `org-lint-config-${pin.version}`);
  const extractedFiles = readExtractedFiles(pin, extractedRoot);
  rejectIfPlanFails(pin, archiveSha256, extractedFiles);
  return publishVendoredFiles(projectRoot, { extractedRoot, pin, write });
};

const regenerate = (projectRoot: string, exec: Exec, write: AtomicWrite): string[] => {
  const session: RegenerateSession = {
    exec,
    pin: loadPin(projectRoot),
    workdir: mkdtempSync(path.join(tmpdir(), "org-lint-config-regenerate-")),
    write,
  };
  try {
    return performRegenerate(projectRoot, session);
  } finally {
    rmSync(session.workdir, { force: true, recursive: true });
  }
};

const runCli = (): void => {
  const written = regenerate(process.cwd(), execStream, atomicWrite);
  written.forEach((vendoredPath) => console.log(`regenerated ${vendoredPath} from ${REPOSITORY}`));
};

if (require.main === module) {
  runCli();
}

module.exports = { regenerate };
