// Delete S3 buckets matching a prefix.
//
// Handles versioned buckets by deleting all object versions and
// Delete markers before removing the bucket itself.

const { execCapture } = require("../../../lib/exec.ts");

interface RunArgs {
  prefix: string;
  region: string;
}

interface VersionEntry {
  Key: string;
  VersionId: string;
}

interface VersionList {
  DeleteMarkers?: VersionEntry[];
  IsTruncated?: boolean;
  NextKeyMarker?: string;
  NextVersionIdMarker?: string;
  Versions?: VersionEntry[];
}

type ExecFn = typeof execCapture;

interface BucketCtx {
  bucket: string;
  exec: ExecFn;
  region: string;
}

interface PageMarker {
  key: string;
  versionId: string;
}

const toEntry = (entry: VersionEntry): VersionEntry => ({ Key: entry.Key, VersionId: entry.VersionId });

const collectObjects = (data: VersionList): VersionEntry[] => [
  ...(data.Versions || []).map(toEntry),
  ...(data.DeleteMarkers || []).map(toEntry),
];

const batchDelete = (ctx: BucketCtx, objects: VersionEntry[]): void => {
  ctx.exec("aws", ["s3api", "delete-objects", "--bucket", ctx.bucket, "--region", ctx.region,
    "--delete", JSON.stringify({ Objects: objects, Quiet: true })]);
};

const listVersionPage = (ctx: BucketCtx, marker: PageMarker): VersionList => {
  const args = ["s3api", "list-object-versions", "--bucket", ctx.bucket, "--region", ctx.region, "--output", "json"];
  if (marker.key) {
    args.push("--key-marker", marker.key);
    args.push("--version-id-marker", marker.versionId);
  }
  return JSON.parse(ctx.exec("aws", args));
};

const processPage = (ctx: BucketCtx, marker: PageMarker): PageMarker | undefined => {
  const data = listVersionPage(ctx, marker);
  const objects = collectObjects(data);
  if (objects.length > 0) { batchDelete(ctx, objects); }
  if (!data.IsTruncated) { return undefined; }
  return { key: data.NextKeyMarker || "", versionId: data.NextVersionIdMarker || "" };
};

const deleteAllVersions = (bucket: string, region: string, exec: ExecFn = execCapture): void => {
  const ctx: BucketCtx = { bucket, exec, region };
  let marker: PageMarker | undefined = { key: "", versionId: "" };
  while (marker) { marker = processPage(ctx, marker); }
};

const listBuckets = (prefix: string, region: string, exec: ExecFn = execCapture): string[] => {
  const raw = exec("aws", ["s3api", "list-buckets", "--region", region, "--output", "json"]);
  const data: { Buckets?: { Name: string }[] } = JSON.parse(raw);
  return (data.Buckets || []).filter((bucket) => bucket.Name.startsWith(prefix)).map((bucket) => bucket.Name);
};

const run = ({ prefix, region }: RunArgs, exec: ExecFn = execCapture): string[] => {
  const buckets = listBuckets(prefix, region, exec);

  for (const bucket of buckets) {
    deleteAllVersions(bucket, region, exec);
    exec("aws", ["s3", "rb", `s3://${bucket}`, "--region", region, "--force"]);
  }

  return buckets;
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
  for (const bucket of deleted) {
    console.log(`Deleted bucket: ${bucket}`);
  }
};

module.exports = Object.assign(main, { deleteAllVersions, listBuckets, run });
