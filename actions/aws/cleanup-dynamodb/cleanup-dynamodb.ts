// Delete DynamoDB tables matching a prefix.
//
// Lists all tables, filters by prefix, and deletes each match.

const { execCapture } = require("../../../lib/exec.ts");

interface RunArgs {
  prefix: string;
  region: string;
}

type ExecFn = typeof execCapture;

interface TablePage {
  LastEvaluatedTableName?: string;
  TableNames?: string[];
}

const fetchTablePage = (region: string, startTable: string | undefined, exec: ExecFn): TablePage => {
  const args = ["dynamodb", "list-tables", "--region", region, "--output", "json"];
  if (startTable) {
    args.push("--exclusive-start-table-name", startTable);
  }
  return JSON.parse(exec("aws", args));
};

const listTables = (prefix: string, region: string, exec: ExecFn = execCapture): string[] => {
  const tables: string[] = [];
  let startTable: string | undefined = undefined;

  for (;;) {
    const page = fetchTablePage(region, startTable, exec);
    tables.push(...(page.TableNames || []).filter((name) => name.startsWith(prefix)));
    if (!page.LastEvaluatedTableName) {
      break;
    }
    startTable = page.LastEvaluatedTableName;
  }

  return tables;
};

const run = ({ prefix, region }: RunArgs, exec: ExecFn = execCapture): string[] => {
  const tables = listTables(prefix, region, exec);

  for (const table of tables) {
    exec("aws", ["dynamodb", "delete-table", "--table-name", table, "--region", region]);
  }

  return tables;
};

interface MainArgs {
  env?: NodeJS.ProcessEnv;
  exec?: ExecFn;
}

const parseRunArgs = (env: NodeJS.ProcessEnv): RunArgs => {
  const prefix = (env.INPUT_PREFIX || "").trim();
  const region = env.INPUT_REGION || "us-east-1";
  if (!prefix) {
    throw new Error("INPUT_PREFIX is required");
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
  for (const table of deleted) {
    console.log(`Deleted table: ${table}`);
  }
};

module.exports = Object.assign(main, { listTables, run });
