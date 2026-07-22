/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 626:
/***/ ((module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const { resolveOutputWriter } = __nccwpck_require__(1);
const { install } = __nccwpck_require__(381);
const { parseInputs } = __nccwpck_require__(795);
const main = async (args = {}) => {
    const inputs = parseInputs(args.env || process.env);
    const installedPath = await install(inputs, { fetchFn: args.fetchFn });
    const writeOutput = resolveOutputWriter({ writeOutput: args.writeOutput });
    writeOutput("path", installedPath);
};
const errorMessage = (error) => {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
};
if (require.main === require.cache[eval('__filename')]) {
    main().catch((error) => {
        console.error(errorMessage(error));
        process.exitCode = 1;
    });
}
module.exports = Object.assign(main, { install, parseInputs });


/***/ }),

/***/ 860:
/***/ ((module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const ORGANIZATION = "pretty-good-software-org";
const REPOSITORY = "org-lint-config";
const API_ROOT = `https://api.github.com/repos/${ORGANIZATION}/${REPOSITORY}`;
const BYTES_PER_KIBIBYTE = 1024;
const MAX_ARCHIVE_MEBIBYTES = 50;
const MAX_ARCHIVE_BYTES = MAX_ARCHIVE_MEBIBYTES * BYTES_PER_KIBIBYTE * BYTES_PER_KIBIBYTE;
const API_VERSION = "2022-11-28";
const requestHeaders = (token, accept) => ({
    Accept: accept,
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": API_VERSION,
});
const requireSuccessfulResponse = (response, operation) => {
    if (!response.ok) {
        throw new Error(`${operation} failed with GitHub status ${response.status}`);
    }
};
const parseRelease = async (response) => {
    try {
        return (await response.json());
    }
    catch (error) {
        throw new Error("parse private release metadata: GitHub returned invalid JSON", { cause: error });
    }
};
const validateRelease = (release, version) => {
    if (release.draft || release.tag_name !== version) {
        throw new Error(`resolve private release ${version}: GitHub returned a different or draft release`);
    }
    if (!Array.isArray(release.assets)) {
        throw new Error(`resolve private release ${version}: GitHub returned an invalid asset list`);
    }
};
const findArchiveAsset = (release, version) => {
    validateRelease(release, version);
    const expectedName = `${REPOSITORY}-${version}.tar.gz`;
    const matches = release.assets.filter((asset) => asset.name === expectedName);
    if (matches.length !== 1) {
        throw new Error(`resolve private release ${version}: expected exactly one ${expectedName} asset`);
    }
    if (!matches[0].url.startsWith(`${API_ROOT}/releases/assets/`)) {
        throw new Error(`resolve private release ${version}: archive asset URL is outside the repository API`);
    }
    return matches[0];
};
const declaredContentLength = (response) => Number(response.headers.get("content-length") || "0");
const enforceCompleteArchive = (response, archive) => {
    const declaredLength = declaredContentLength(response);
    if (declaredLength > MAX_ARCHIVE_BYTES || archive.byteLength > MAX_ARCHIVE_BYTES) {
        throw new Error(`download private release archive: asset exceeds ${MAX_ARCHIVE_BYTES} bytes`);
    }
    if (declaredLength && declaredLength !== archive.byteLength) {
        throw new Error("download private release archive: response body is incomplete");
    }
};
const downloadReleaseArchive = async (version, token, fetchFn = fetch) => {
    const releaseUrl = `${API_ROOT}/releases/tags/${encodeURIComponent(version)}`;
    const releaseResponse = await fetchFn(releaseUrl, {
        headers: requestHeaders(token, "application/vnd.github+json"),
    });
    requireSuccessfulResponse(releaseResponse, `read private release ${version}`);
    const release = await parseRelease(releaseResponse);
    const asset = findArchiveAsset(release, version);
    const assetResponse = await fetchFn(asset.url, {
        headers: requestHeaders(token, "application/octet-stream"),
        redirect: "follow",
    });
    requireSuccessfulResponse(assetResponse, `download private release ${version}`);
    const archive = Buffer.from(await assetResponse.arrayBuffer());
    enforceCompleteArchive(assetResponse, archive);
    return archive;
};
module.exports = { downloadReleaseArchive };


/***/ }),

/***/ 412:
/***/ ((module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const { closeSync, mkdirSync, openSync, writeFileSync } = __nccwpck_require__(24);
const path = __nccwpck_require__(760);
const { gunzipSync } = __nccwpck_require__(522);
const { DIRECTORY_TYPE, parseTar } = __nccwpck_require__(745);
const BYTES_PER_KIBIBYTE = 1024;
const MAX_EXTRACTED_MEBIBYTES = 100;
const MAX_EXTRACTED_BYTES = MAX_EXTRACTED_MEBIBYTES * BYTES_PER_KIBIBYTE * BYTES_PER_KIBIBYTE;
const PERMISSION_MASK = 0o777;
const DEFAULT_DIRECTORY_MODE = 0o755;
const unsafeComponent = (component) => !component || component === "." || component === "..";
const unsafeEntryName = (entryName) => !entryName || entryName.startsWith("/") || entryName.includes("\\");
const safeRelativePath = (entryName, expectedRoot) => {
    if (unsafeEntryName(entryName)) {
        throw new Error(`extract release archive: unsafe entry path ${JSON.stringify(entryName)}`);
    }
    const components = entryName.replace(/\/+$/, "").split("/");
    if (components.some(unsafeComponent)) {
        throw new Error(`extract release archive: unsafe entry path ${JSON.stringify(entryName)}`);
    }
    if (components[0] !== expectedRoot) {
        throw new Error(`extract release archive: entry is outside expected root ${expectedRoot}`);
    }
    return components.slice(1).join(path.sep);
};
const prepareEntries = (entries, expectedRoot) => entries.map((entry) => ({ ...entry, relativePath: safeRelativePath(entry.name, expectedRoot) }));
const validateRoot = (entries) => {
    const rootEntries = entries.filter((entry) => !entry.relativePath);
    if (rootEntries.length !== 1 || rootEntries[0].type !== DIRECTORY_TYPE) {
        throw new Error("extract release archive: expected one top-level directory");
    }
    if (!entries.some((entry) => entry.relativePath && entry.type !== DIRECTORY_TYPE)) {
        throw new Error("extract release archive: expected a non-empty top-level directory");
    }
};
const validateUniquePaths = (entries) => {
    const paths = entries.map((entry) => entry.relativePath).filter(Boolean);
    if (new Set(paths).size !== paths.length) {
        throw new Error("extract release archive: duplicate entry path");
    }
};
const writeFileExclusively = (target, data, mode) => {
    const descriptor = openSync(target, "wx", mode & PERMISSION_MASK);
    try {
        writeFileSync(descriptor, data);
    }
    finally {
        closeSync(descriptor);
    }
};
const writeEntry = (entry, destination) => {
    const target = path.join(destination, entry.relativePath);
    if (entry.type === DIRECTORY_TYPE) {
        mkdirSync(target, { mode: entry.mode & PERMISSION_MASK, recursive: true });
        return;
    }
    mkdirSync(path.dirname(target), { mode: DEFAULT_DIRECTORY_MODE, recursive: true });
    writeFileExclusively(target, entry.data, entry.mode);
};
const writeEntries = (entries, destination) => {
    mkdirSync(destination, { mode: DEFAULT_DIRECTORY_MODE });
    entries.filter((entry) => entry.relativePath).forEach((entry) => writeEntry(entry, destination));
};
const decompressArchive = (compressedArchive) => {
    try {
        return gunzipSync(compressedArchive, { maxOutputLength: MAX_EXTRACTED_BYTES });
    }
    catch (error) {
        throw new Error("extract release archive: invalid or oversized gzip data", { cause: error });
    }
};
const extractArchive = (compressedArchive, destination, expectedRoot) => {
    const entries = prepareEntries(parseTar(decompressArchive(compressedArchive)), expectedRoot);
    validateRoot(entries);
    validateUniquePaths(entries);
    writeEntries(entries, destination);
};
module.exports = { extractArchive };


/***/ }),

/***/ 381:
/***/ ((module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const { createHash } = __nccwpck_require__(598);
const { mkdirSync, mkdtempSync, rmSync } = __nccwpck_require__(24);
const path = __nccwpck_require__(760);
const { downloadReleaseArchive } = __nccwpck_require__(860);
const { extractArchive } = __nccwpck_require__(412);
const { publishDirectory } = __nccwpck_require__(827);
const errorMessage = (error) => {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
};
const verifyDigest = (archive, expectedDigest) => {
    const actualDigest = createHash("sha256").update(archive).digest("hex");
    if (actualDigest !== expectedDigest) {
        throw new Error(`verify release archive: SHA-256 mismatch; expected ${expectedDigest}, got ${actualDigest}`);
    }
};
const createOutputParent = (outputParent) => {
    try {
        mkdirSync(outputParent, { recursive: true });
    }
    catch (error) {
        throw new Error(`create output parent ${outputParent}`, { cause: error });
    }
};
const createInstallLayout = (requestedOutput) => {
    const outputDirectory = path.resolve(requestedOutput);
    const outputName = path.basename(outputDirectory);
    if (!outputName) {
        throw new Error("resolve output directory: filesystem root is not a valid output directory");
    }
    const outputParent = path.dirname(outputDirectory);
    createOutputParent(outputParent);
    try {
        const workspace = mkdtempSync(path.join(outputParent, `.${outputName}.install-`));
        return { outputDirectory, stagingDirectory: path.join(workspace, "staged"), workspace };
    }
    catch (error) {
        throw new Error(`create installer workspace beside ${outputDirectory}`, { cause: error });
    }
};
const performInstall = async (inputs, layout, dependencies) => {
    const archive = await downloadReleaseArchive(inputs.version, inputs.token, dependencies.fetchFn);
    verifyDigest(archive, inputs.sha256);
    extractArchive(archive, layout.stagingDirectory, `org-lint-config-${inputs.version}`);
    publishDirectory(layout.stagingDirectory, layout.outputDirectory);
};
const removeWorkspace = (workspace) => {
    try {
        rmSync(workspace, { force: true, recursive: true });
    }
    catch (error) {
        throw new Error(`clean installer workspace ${workspace}`, { cause: error });
    }
};
const cleanupAfterFailure = (layout, failure, version) => {
    try {
        removeWorkspace(layout.workspace);
    }
    catch (cleanupError) {
        const message = `install org-lint-config ${version} and cleanup failed after ${errorMessage(failure)}`;
        throw new Error(message, { cause: cleanupError });
    }
    throw failure;
};
const install = async (inputs, dependencies = {}) => {
    const layout = createInstallLayout(inputs.outputDirectory);
    try {
        await performInstall(inputs, layout, dependencies);
    }
    catch (error) {
        const failure = new Error(`install org-lint-config ${inputs.version}: ${errorMessage(error)}`, { cause: error });
        cleanupAfterFailure(layout, failure, inputs.version);
    }
    removeWorkspace(layout.workspace);
    return layout.outputDirectory;
};
module.exports = { install, verifyDigest };


/***/ }),

/***/ 795:
/***/ ((module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const VERSION_PATTERN = /^v\d+\.\d+\.\d+$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const requiredInput = (env, name) => {
    const value = env[name] || "";
    if (!value) {
        throw new Error(`${name} is required`);
    }
    return value;
};
const parseInputs = (env) => {
    const version = requiredInput(env, "INPUT_VERSION");
    if (!VERSION_PATTERN.test(version)) {
        throw new Error("INPUT_VERSION must be an exact release tag in v1.0.0 form");
    }
    const sha256 = requiredInput(env, "INPUT_SHA256");
    if (!SHA256_PATTERN.test(sha256)) {
        throw new Error("INPUT_SHA256 must be exactly 64 lowercase hexadecimal characters");
    }
    return {
        outputDirectory: requiredInput(env, "INPUT_OUTPUT_DIRECTORY"),
        sha256,
        token: requiredInput(env, "INPUT_TOKEN"),
        version,
    };
};
module.exports = { parseInputs };


/***/ }),

/***/ 827:
/***/ ((module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const { createHash } = __nccwpck_require__(598);
const { lstatSync, readFileSync, readdirSync, renameSync, rmSync } = __nccwpck_require__(24);
const path = __nccwpck_require__(760);
const EXECUTABLE_MASK = 0o111;
const missingPath = (error) => error.code === "ENOENT";
const pathExists = (target) => {
    try {
        lstatSync(target);
        return true;
    }
    catch (error) {
        if (missingPath(error)) {
            return false;
        }
        throw new Error(`inspect output path ${target}`, { cause: error });
    }
};
const fileEntry = (root, relativePath) => {
    const target = path.join(root, relativePath);
    const stat = lstatSync(target);
    if (stat.isSymbolicLink() || !stat.isFile()) {
        throw new Error(`publish verified release: unsupported output entry ${relativePath}`);
    }
    const digest = createHash("sha256").update(readFileSync(target)).digest("hex");
    return { digest, executable: Boolean(stat.mode & EXECUTABLE_MASK), path: relativePath, type: "file" };
};
const describeEntry = (root, relativePath) => {
    const target = path.join(root, relativePath);
    const stat = lstatSync(target);
    if (stat.isSymbolicLink()) {
        throw new Error("publish verified release: output trees must not contain symbolic links");
    }
    if (!stat.isDirectory()) {
        return [fileEntry(root, relativePath)];
    }
    const directory = { path: relativePath, type: "directory" };
    return [directory, ...describeDirectory(root, relativePath)];
};
const describeDirectory = (root, relativePath = "") => {
    const directory = path.join(root, relativePath);
    return readdirSync(directory)
        .toSorted()
        .flatMap((name) => describeEntry(root, path.join(relativePath, name)));
};
const directoriesEqual = (left, right) => JSON.stringify(describeDirectory(left)) === JSON.stringify(describeDirectory(right));
const publishNewDirectory = (stagingDirectory, outputDirectory) => {
    try {
        renameSync(stagingDirectory, outputDirectory);
    }
    catch (error) {
        throw new Error(`atomically publish verified release to ${outputDirectory}`, { cause: error });
    }
};
const validateExistingDirectory = (stagingDirectory, outputDirectory) => {
    const outputStat = lstatSync(outputDirectory);
    if (outputStat.isSymbolicLink() || !outputStat.isDirectory()) {
        throw new Error(`publish verified release: output path is not a real directory: ${outputDirectory}`);
    }
    if (!directoriesEqual(stagingDirectory, outputDirectory)) {
        throw new Error(`publish verified release: output directory already has different contents: ${outputDirectory}`);
    }
};
const removeIdenticalStaging = (stagingDirectory) => {
    try {
        rmSync(stagingDirectory, { recursive: true });
    }
    catch (error) {
        throw new Error(`remove identical staging directory ${stagingDirectory}`, { cause: error });
    }
};
const publishDirectory = (stagingDirectory, outputDirectory) => {
    if (!pathExists(outputDirectory)) {
        publishNewDirectory(stagingDirectory, outputDirectory);
        return;
    }
    validateExistingDirectory(stagingDirectory, outputDirectory);
    removeIdenticalStaging(stagingDirectory);
};
module.exports = { publishDirectory };


/***/ }),

/***/ 745:
/***/ ((module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const TAR_BLOCK_BYTES = 512;
const TRAILER_BLOCK_COUNT = 2;
const TAR_TRAILER_BYTES = TAR_BLOCK_BYTES * TRAILER_BLOCK_COUNT;
const OCTAL_RADIX = 8;
const CHECKSUM_SPACE = 0x20;
const FILE_TYPE = "0";
const DIRECTORY_TYPE = "5";
const NAME_START = 0;
const NAME_END = 100;
const MODE_START = 100;
const MODE_END = 108;
const SIZE_START = 124;
const SIZE_END = 136;
const CHECKSUM_START = 148;
const CHECKSUM_END = 156;
const TYPE_START = 156;
const TYPE_END = 157;
const PREFIX_START = 345;
const PREFIX_END = 500;
const isZeroBlock = (block) => block.every((byte) => byte === 0);
const readString = (field) => {
    const nullIndex = field.indexOf(0);
    if (nullIndex === -1) {
        return field.toString("utf8");
    }
    return field.subarray(0, nullIndex).toString("utf8");
};
const parseOctal = (field, label) => {
    const value = readString(field).trim();
    if (!/^[0-7]+$/.test(value)) {
        throw new Error(`extract release archive: invalid tar ${label}`);
    }
    return Number.parseInt(value, OCTAL_RADIX);
};
const verifyHeaderChecksum = (header) => {
    const expected = parseOctal(header.subarray(CHECKSUM_START, CHECKSUM_END), "header checksum");
    const checksumHeader = Buffer.from(header);
    checksumHeader.fill(CHECKSUM_SPACE, CHECKSUM_START, CHECKSUM_END);
    const actual = checksumHeader.reduce((sum, byte) => sum + byte, 0);
    if (actual !== expected) {
        throw new Error("extract release archive: invalid tar header checksum");
    }
};
const entryName = (header) => {
    const name = readString(header.subarray(NAME_START, NAME_END));
    const prefix = readString(header.subarray(PREFIX_START, PREFIX_END));
    if (!prefix) {
        return name;
    }
    return `${prefix}/${name}`;
};
const parseHeader = (header) => {
    verifyHeaderChecksum(header);
    return {
        mode: parseOctal(header.subarray(MODE_START, MODE_END), "mode"),
        name: entryName(header),
        size: parseOctal(header.subarray(SIZE_START, SIZE_END), "size"),
        type: readString(header.subarray(TYPE_START, TYPE_END)) || FILE_TYPE,
    };
};
const ensureSafeType = (entry) => {
    if (entry.type !== FILE_TYPE && entry.type !== DIRECTORY_TYPE) {
        throw new Error(`extract release archive: unsupported tar entry type ${JSON.stringify(entry.type)}`);
    }
    if (entry.type === DIRECTORY_TYPE && entry.data.length !== 0) {
        throw new Error("extract release archive: directory entry contains data");
    }
};
const readEntry = (archive, offset) => {
    const header = archive.subarray(offset, offset + TAR_BLOCK_BYTES);
    const parsedHeader = parseHeader(header);
    const dataStart = offset + TAR_BLOCK_BYTES;
    const dataEnd = dataStart + parsedHeader.size;
    if (dataEnd > archive.length) {
        throw new Error("extract release archive: truncated tar entry");
    }
    const entry = { ...parsedHeader, data: archive.subarray(dataStart, dataEnd) };
    ensureSafeType(entry);
    const paddedSize = Math.ceil(parsedHeader.size / TAR_BLOCK_BYTES) * TAR_BLOCK_BYTES;
    return { entry, nextOffset: dataStart + paddedSize };
};
const verifyTrailer = (archive, offset) => {
    const trailerEnd = offset + TAR_TRAILER_BYTES;
    if (trailerEnd > archive.length || !isZeroBlock(archive.subarray(offset + TAR_BLOCK_BYTES, trailerEnd))) {
        throw new Error("extract release archive: incomplete tar trailer");
    }
    if (!archive.subarray(trailerEnd).every((byte) => byte === 0)) {
        throw new Error("extract release archive: data follows tar trailer");
    }
};
const appendEntry = (archive, offset, entries) => {
    const parsedEntry = readEntry(archive, offset);
    entries.push(parsedEntry.entry);
    return parsedEntry.nextOffset;
};
const parseTar = (archive) => {
    const entries = [];
    let offset = 0;
    while (offset + TAR_BLOCK_BYTES <= archive.length) {
        const header = archive.subarray(offset, offset + TAR_BLOCK_BYTES);
        if (isZeroBlock(header)) {
            verifyTrailer(archive, offset);
            return entries;
        }
        offset = appendEntry(archive, offset, entries);
    }
    throw new Error("extract release archive: tar trailer is missing");
};
module.exports = { DIRECTORY_TYPE, parseTar };


/***/ }),

/***/ 1:
/***/ ((module, exports, __nccwpck_require__) => {


// GitHub Actions output writer.
//
// Writes step outputs via the GITHUB_OUTPUT file mechanism.
// Supports injecting core.setOutput or a custom writer in tests.
Object.defineProperty(exports, "__esModule", ({ value: true }));
const { appendFileSync } = __nccwpck_require__(24);
const { randomUUID } = __nccwpck_require__(598);
const writeGitHubOutput = (name, value) => {
    const outputFile = process.env.GITHUB_OUTPUT;
    if (!outputFile) {
        throw new Error("GITHUB_OUTPUT is not set — cannot write output");
    }
    const delimiter = `ghadelimiter_${randomUUID()}`;
    appendFileSync(outputFile, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
};
const resolveOutputWriter = ({ core, writeOutput }) => {
    if (writeOutput) {
        return writeOutput;
    }
    if (core) {
        return (name, value) => core.setOutput(name, value);
    }
    return writeGitHubOutput;
};
module.exports = { resolveOutputWriter, writeGitHubOutput };


/***/ }),

/***/ 598:
/***/ ((module) => {

module.exports = require("node:crypto");

/***/ }),

/***/ 24:
/***/ ((module) => {

module.exports = require("node:fs");

/***/ }),

/***/ 760:
/***/ ((module) => {

module.exports = require("node:path");

/***/ }),

/***/ 522:
/***/ ((module) => {

module.exports = require("node:zlib");

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
/******/ 	var __webpack_exports__ = __nccwpck_require__(626);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;