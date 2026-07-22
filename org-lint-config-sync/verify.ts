// ROAD SIGN: .lint/configs/* are committed, checksum-pinned copies of files
// Published in the private pretty-good-software-org/org-lint-config release.
// Ci-shared is public, so pull-request CI must not depend on the
// CI_PRIVATE_CONTENT GitHub App secret used by actions/setup/org-lint-config
// (GitHub does not forward org secrets to fork PRs, and org policy keeps
// Public-repo PR CI secret-free regardless). This check verifies the
// Committed files by literal SHA-256 only — no network, no secrets. The pin
// Is `.org-lint-config.json`; the authoritative source is the private
// Org-lint-config repo. To adopt a new release, follow the verified
// Pin-update procedure in AGENTS.md ("Updating the Pinned org-lint-config
// Release") before running `mise run org-lint-config:regenerate` (requires
// `gh auth login` against that repo). Regeneration only re-verifies and
// Republishes an already-vetted pin — it must never be trusted to
// Originate one.

const { createHash } = require("node:crypto");

import type { OrgLintConfigPin } from "./pin-types.ts";

const { loadPin } = require("./pin.ts");
const { readIfExists } = require("./optional-read.ts");
const { resolveWithinRoot } = require("./safe-path.ts");

export interface VerifyFailure {
  actualSha256?: string;
  expectedSha256: string;
  reason: "mismatch" | "missing";
  vendoredPath: string;
}

const readActualSha256 = (filePath: string): string | undefined => {
  const contents = readIfExists(filePath);
  if (contents === undefined) {
    return undefined;
  }
  return createHash("sha256").update(contents).digest("hex");
};

const verifyVendoredFile = (
  projectRoot: string,
  vendoredPath: string,
  expectedSha256: string,
): VerifyFailure | undefined => {
  const filePath = resolveWithinRoot("verify vendored file", projectRoot, vendoredPath);
  const actualSha256 = readActualSha256(filePath);
  if (actualSha256 === undefined) {
    return { expectedSha256, reason: "missing", vendoredPath };
  }
  if (actualSha256 !== expectedSha256) {
    return { actualSha256, expectedSha256, reason: "mismatch", vendoredPath };
  }
  return undefined;
};

const verifyPin = (projectRoot: string, pin: OrgLintConfigPin): VerifyFailure[] =>
  Object.entries(pin.vendoredFiles)
    .map(([vendoredPath, entry]) => verifyVendoredFile(projectRoot, vendoredPath, entry.sha256))
    .filter((failure): failure is VerifyFailure => failure !== undefined);

const verify = (projectRoot: string): VerifyFailure[] => verifyPin(projectRoot, loadPin(projectRoot));

const describeFailure = (failure: VerifyFailure): string => {
  if (failure.reason === "missing") {
    return `${failure.vendoredPath}: missing (pinned SHA-256 ${failure.expectedSha256})`;
  }
  return `${failure.vendoredPath}: SHA-256 mismatch — pinned ${failure.expectedSha256}, actual ${failure.actualSha256}`;
};

const runCli = (): void => {
  const failures = verify(process.cwd());
  if (failures.length === 0) {
    console.log("org-lint-config: all vendored files match their pinned SHA-256");
    return;
  }
  console.error("org-lint-config: vendored file verification failed");
  failures.forEach((failure) => console.error(`  ${describeFailure(failure)}`));
  console.error(
    "If a vendored file was hand-edited, revert it — it must only ever be regeneration's output. If " +
      ".org-lint-config.json was deliberately updated to a new release, run 'mise run org-lint-config:regenerate' " +
      'to publish it (see AGENTS.md, "Updating the Pinned org-lint-config Release").',
  );
  process.exitCode = 1;
};

if (require.main === module) {
  runCli();
}

module.exports = { describeFailure, verify, verifyPin };
