// Delete all object versions and delete markers from an S3 bucket.

import type { ExecFn } from "./action-types.ts";

const { execCapture } = require("../../../lib/exec.ts");

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

const BATCH_LIMIT = 1000;

const batchDelete = (ctx: BucketCtx, objects: VersionEntry[]): void => {
  for (let i = 0; i < objects.length; i += BATCH_LIMIT) {
    const chunk = objects.slice(i, i + BATCH_LIMIT);
    ctx.exec("aws", [
      "s3api",
      "delete-objects",
      "--bucket",
      ctx.bucket,
      "--region",
      ctx.region,
      "--delete",
      JSON.stringify({ Objects: chunk, Quiet: true }),
    ]);
  }
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
  if (objects.length > 0) {
    batchDelete(ctx, objects);
  }
  if (!data.IsTruncated) {
    return undefined;
  }
  return { key: data.NextKeyMarker || "", versionId: data.NextVersionIdMarker || "" };
};

const deleteAllVersions = (bucket: string, region: string, exec: ExecFn = execCapture): void => {
  const ctx: BucketCtx = { bucket, exec, region };
  let marker: PageMarker | undefined = { key: "", versionId: "" };
  while (marker) {
    marker = processPage(ctx, marker);
  }
};

module.exports = { deleteAllVersions };
export type { BucketCtx, PageMarker, VersionEntry, VersionList };
