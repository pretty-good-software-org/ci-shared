// List S3 buckets matching a name prefix.

import type { ExecFn } from "./action-types.ts";

const { execCapture } = require("../../../lib/exec.ts");

const listBuckets = (prefix: string, region: string, exec: ExecFn = execCapture): string[] => {
  const raw = exec("aws", ["s3api", "list-buckets", "--region", region, "--output", "json"]);
  const data: { Buckets?: { Name: string }[] } = JSON.parse(raw);
  return (data.Buckets || []).filter((bucket) => bucket.Name.startsWith(prefix)).map((bucket) => bucket.Name);
};

module.exports = { listBuckets };
