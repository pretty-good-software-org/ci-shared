// List DynamoDB tables matching a prefix with pagination.

import type { ExecFn } from "./action-types.ts";

const { execCapture } = require("../../../lib/exec.ts");

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

module.exports = { listTables };
export type { TablePage };
