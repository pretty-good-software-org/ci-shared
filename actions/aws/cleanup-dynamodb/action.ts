// Delete DynamoDB tables matching a prefix.
//
// Lists all tables, filters by prefix, and deletes each match.

import type { ExecFn } from "./action-types.ts";

const { execCapture } = require("../../../lib/exec.ts");
const { listTables } = require("./list-tables.ts");

interface RunArgs {
  prefix: string;
  region: string;
}

const MIN_PREFIX_LENGTH = 5;

const run = ({ prefix, region }: RunArgs, exec: ExecFn = execCapture): string[] => {
  const tables = listTables(prefix, region, exec);
  const failed: string[] = [];

  for (const table of tables) {
    try {
      exec("aws", ["dynamodb", "delete-table", "--table-name", table, "--region", region]);
    } catch {
      failed.push(table);
    }
  }

  if (failed.length > 0) {
    throw new Error(`Failed to delete ${failed.length} table(s): ${failed.join(", ")}`);
  }

  return tables;
};

interface MainArgs {
  env?: NodeJS.ProcessEnv;
  exec?: ExecFn;
}

const validateRegion = (region: string): void => {
  if (!/^[a-z]{2}-[a-z]+-\d+$/.test(region)) {
    throw new Error(`Invalid AWS region: ${region}`);
  }
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
  validateRegion(region);
  return { prefix, region };
};

const main = (args: MainArgs = {}): void => {
  const env = args.env || process.env;
  const runArgs = parseRunArgs(env);
  const deleted = run(runArgs, args.exec || execCapture);
  for (const table of deleted) {
    console.log(`Deleted table: ${table}`);
  }
};

module.exports = Object.assign(main, { listTables, run });
