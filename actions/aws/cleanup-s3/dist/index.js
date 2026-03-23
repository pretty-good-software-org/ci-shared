/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 836:
/***/ ((module, exports, __nccwpck_require__) => {


// Delete S3 buckets matching a prefix.
//
// Handles versioned buckets by deleting all object versions and
// Delete markers before removing the bucket itself.
Object.defineProperty(exports, "__esModule", ({ value: true }));
const { execCapture } = __nccwpck_require__(361);
const { deleteAllVersions } = __nccwpck_require__(27);
const { listBuckets } = __nccwpck_require__(368);
const MIN_PREFIX_LENGTH = 5;
const run = ({ prefix, region }, exec = execCapture) => {
    const buckets = listBuckets(prefix, region, exec);
    const failed = [];
    for (const bucket of buckets) {
        try {
            deleteAllVersions(bucket, region, exec);
            exec("aws", ["s3", "rb", `s3://${bucket}`, "--region", region, "--force"]);
        }
        catch {
            failed.push(bucket);
        }
    }
    if (failed.length > 0) {
        throw new Error(`Failed to delete ${failed.length} bucket(s): ${failed.join(", ")}`);
    }
    return buckets;
};
const validateRegion = (region) => {
    if (!/^[a-z]{2}-[a-z]+-\d+$/.test(region)) {
        throw new Error(`Invalid AWS region: ${region}`);
    }
};
const parseRunArgs = (env) => {
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
const main = (args = {}) => {
    const env = args.env || process.env;
    const runArgs = parseRunArgs(env);
    const deleted = run(runArgs, args.exec || execCapture);
    for (const bucket of deleted) {
        console.log(`Deleted bucket: ${bucket}`);
    }
};
module.exports = Object.assign(main, { deleteAllVersions, listBuckets, run });


/***/ }),

/***/ 27:
/***/ ((module, exports, __nccwpck_require__) => {


// Delete all object versions and delete markers from an S3 bucket.
Object.defineProperty(exports, "__esModule", ({ value: true }));
const { execCapture } = __nccwpck_require__(361);
const toEntry = (entry) => ({ Key: entry.Key, VersionId: entry.VersionId });
const collectObjects = (data) => [
    ...(data.Versions || []).map(toEntry),
    ...(data.DeleteMarkers || []).map(toEntry),
];
const BATCH_LIMIT = 1000;
const batchDelete = (ctx, objects) => {
    for (let idx = 0; idx < objects.length; idx += BATCH_LIMIT) {
        const chunk = objects.slice(idx, idx + BATCH_LIMIT);
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
const listVersionPage = (ctx, marker) => {
    const args = ["s3api", "list-object-versions", "--bucket", ctx.bucket, "--region", ctx.region, "--output", "json"];
    if (marker.key) {
        args.push("--key-marker", marker.key);
        args.push("--version-id-marker", marker.versionId);
    }
    return JSON.parse(ctx.exec("aws", args));
};
const processPage = (ctx, marker) => {
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
const deleteAllVersions = (bucket, region, exec = execCapture) => {
    const ctx = { bucket, exec, region };
    let marker = { key: "", versionId: "" };
    while (marker) {
        marker = processPage(ctx, marker);
    }
};
module.exports = { deleteAllVersions };


/***/ }),

/***/ 368:
/***/ ((module, exports, __nccwpck_require__) => {


// List S3 buckets matching a name prefix.
Object.defineProperty(exports, "__esModule", ({ value: true }));
const { execCapture } = __nccwpck_require__(361);
const listBuckets = (prefix, region, exec = execCapture) => {
    const raw = exec("aws", ["s3api", "list-buckets", "--region", region, "--output", "json"]);
    const data = JSON.parse(raw);
    return (data.Buckets || []).filter((bucket) => bucket.Name.startsWith(prefix)).map((bucket) => bucket.Name);
};
module.exports = { listBuckets };


/***/ }),

/***/ 361:
/***/ ((module, exports, __nccwpck_require__) => {


// Shared execution helpers wrapping child_process.execFileSync.
//
// All functions use execFileSync (no shell) to prevent command injection.
// Three variants covering every action's needs:
// - execCapture: returns stdout (pipe mode)
// - execStream: streams to console (inherit mode)
// - execStreamWithEnv: streams to console with optional env override
Object.defineProperty(exports, "__esModule", ({ value: true }));
const { execFileSync } = __nccwpck_require__(421);
const logStderr = (error) => {
    const stderr = String(error.stderr || "").trim();
    if (stderr) {
        console.error(stderr);
    }
};
const MEGABYTES_50 = 50;
const BYTES_PER_KB = 1024;
const KB_PER_MB = 1024;
const MAX_BUFFER = MEGABYTES_50 * BYTES_PER_KB * KB_PER_MB; // 50 MB — default 1 MB is too small for large tofu plan JSON
const execCapture = (bin, args) => {
    console.log(`+ ${bin} ${args.join(" ")}`);
    try {
        const output = execFileSync(bin, args, { encoding: "utf8", maxBuffer: MAX_BUFFER, stdio: "pipe" });
        if (output) {
            console.log(output);
        }
        return output;
    }
    catch (error) {
        logStderr(error);
        throw error;
    }
};
const execStream = (bin, args) => {
    console.log(`+ ${bin} ${args.join(" ")}`);
    execFileSync(bin, args, { stdio: "inherit" });
};
const execStreamWithEnv = (bin, args, env) => {
    console.log(`+ ${bin} ${args.join(" ")}`);
    execFileSync(bin, args, { env, stdio: "inherit" });
};
module.exports = { execCapture, execStream, execStreamWithEnv };


/***/ }),

/***/ 421:
/***/ ((module) => {

module.exports = require("node:child_process");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId](module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __nccwpck_require__(836);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;