// Delete S3 buckets matching a prefix.
//
// Handles versioned buckets by deleting all object versions and
// Delete markers before removing the bucket itself.

import type { ExecFn } from "./action-types.ts";

const { execCapture } = require("../../../lib/exec.ts");
const { deleteAllVersions } = require("./delete-versions.ts");
const { listBuckets } = require("./list-buckets.ts");

interface RunArgs {
  prefix: string;
  region: string;
}

interface MainArgs {
  env?: NodeJS.ProcessEnv;
  exec?: ExecFn;
}

const MIN_PREFIX_LENGTH = 5;

const run = ({ prefix, region }: RunArgs, exec: ExecFn = execCapture): string[] => {
  const buckets = listBuckets(prefix, region, exec);
  const failed: string[] = [];

  for (const bucket of buckets) {
    try {
      deleteAllVersions(bucket, region, exec);
      exec("aws", ["s3", "rb", `s3://${bucket}`, "--region", region, "--force"]);
    } catch {
      failed.push(bucket);
    }
  }

  if (failed.length > 0) {
    throw new Error(`Failed to delete ${failed.length} bucket(s): ${failed.join(", ")}`);
  }

  return buckets;
};

const parseRunArgs = (env: NodeJS.ProcessEnv): RunArgs => {
  const prefix = (env.INPUT_PREFIX || "").trim();
  const region = env.INPUT_REGION || "us-east-1";
  if (!prefix) {
    throw new Error("INPUT_PREFIX is required");
  }
  if (prefix.length < MIN_PREFIX_LENGTH) {
    throw new Error(`INPUT_PREFIX must be at least ${MIN_PREFIX_LENGTH} characters (got "${prefix}")`);
  }
  if (!/^[a-z]{2}-[a-z]+-\d+$/.test(region)) {
    throw new Error(`Invalid AWS region: ${region}`);
  }
  return { prefix, region };
};

const main = (args: MainArgs = {}): void => {
  const env = args.env || process.env;
  const runArgs = parseRunArgs(env);
  const deleted = run(runArgs, args.exec || execCapture);
  for (const bucket of deleted) {
    console.log(`Deleted bucket: ${bucket}`);
  }
};

module.exports = Object.assign(main, { deleteAllVersions, listBuckets, run });
