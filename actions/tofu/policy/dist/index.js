/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 673:
/***/ ((module, exports, __nccwpck_require__) => {


// Run Conftest policy checks against an OpenTofu plan.
Object.defineProperty(exports, "__esModule", ({ value: true }));
const { execCapture } = __nccwpck_require__(6);
const { resolveOutputWriter } = __nccwpck_require__(96);
const { findFloorExemptReason, validateConftestIntegrity } = __nccwpck_require__(59);
const { conftestEnvironmentFailure } = __nccwpck_require__(677);
const { parseRequiredNamespaces } = __nccwpck_require__(631);
const { runPinnedPolicy } = __nccwpck_require__(195);
const { evaluatePolicy, execErrorOutput } = __nccwpck_require__(299);
const POLICY_REPOSITORY = "git::ssh://git@github.com/pretty-good-software-org/opa-policies.git//policy";
const inspectPolicyConfiguration = (cwd) => {
    const integrityFailure = validateConftestIntegrity(cwd);
    if (integrityFailure) {
        return { floorExemptReason: "", integrityFailure };
    }
    return { floorExemptReason: findFloorExemptReason(cwd), integrityFailure: "" };
};
const configurationFailureResult = (configuration) => ({
    floorExemptReason: configuration.floorExemptReason,
    hasViolations: true,
    policyIntegrityFailed: true,
    policyViolations: configuration.integrityFailure,
});
const run = ({ planJson, cwd = process.cwd() }, exec = execCapture) => {
    const configuration = inspectPolicyConfiguration(cwd);
    if (configuration.integrityFailure) {
        return configurationFailureResult(configuration);
    }
    try {
        const commandArguments = ["pull", POLICY_REPOSITORY];
        exec("conftest", commandArguments);
    }
    catch (error) {
        return {
            floorExemptReason: configuration.floorExemptReason,
            hasViolations: true,
            policyIntegrityFailed: true,
            policyViolations: `Policy integrity check failed: conftest pull failed: ${execErrorOutput(error)}`,
        };
    }
    const commandArguments = ["test", "--quiet=false", planJson];
    return evaluatePolicy(commandArguments, exec, configuration.floorExemptReason);
};
const runPinned = (inputs, cwd, exec) => {
    const configuration = inspectPolicyConfiguration(cwd || process.cwd());
    if (configuration.integrityFailure) {
        return configurationFailureResult(configuration);
    }
    const pinnedPolicyArgs = {
        exec,
        floorExemptReason: configuration.floorExemptReason,
        planJson: inputs.planJson,
        policyRef: inputs.policyRef,
        requiredNamespaces: inputs.requiredNamespaces,
    };
    return runPinnedPolicy(pinnedPolicyArgs);
};
const resolvePolicyInputs = (env) => ({
    planJson: env.INPUT_PLAN_JSON || "tofu/plan.json",
    policyRef: (env.INPUT_POLICY_REF || "").trim(),
    requiredNamespaces: parseRequiredNamespaces(env.INPUT_REQUIRED_NAMESPACES || ""),
});
const runRequestedPolicy = (inputs, cwd, exec) => {
    if (!inputs.policyRef && inputs.requiredNamespaces.length === 0) {
        const runArgs = { cwd, planJson: inputs.planJson };
        return run(runArgs, exec);
    }
    return runPinned(inputs, cwd, exec);
};
// Conftest settings in the environment outrank the isolated configuration file.
// The run therefore stops before any policy is fetched or evaluated.
const evaluateRequest = (args, env, exec) => {
    const environmentFailure = conftestEnvironmentFailure(env);
    if (environmentFailure) {
        const configuration = { floorExemptReason: "", integrityFailure: environmentFailure };
        return configurationFailureResult(configuration);
    }
    const policyInputs = resolvePolicyInputs(env);
    return runRequestedPolicy(policyInputs, args.cwd, exec);
};
const enforcePolicyIntegrity = (result) => {
    if (result.policyIntegrityFailed) {
        throw new Error(result.policyViolations);
    }
};
const resolveWarningLogger = (logWarning) => logWarning || console.warn;
const logFloorExemption = (reason, logWarning) => {
    if (reason) {
        logWarning(`POLICY FLOOR EXEMPTION ACTIVE: ${reason}`);
    }
};
const main = async (args = {}) => {
    const { env = process.env, exec = execCapture } = args;
    const result = evaluateRequest(args, env, exec);
    logFloorExemption(result.floorExemptReason, resolveWarningLogger(args.logWarning));
    const setOutput = resolveOutputWriter(args);
    setOutput("has_violations", String(result.hasViolations));
    setOutput("policy_violations", result.policyViolations);
    enforcePolicyIntegrity(result);
};
module.exports = Object.assign(main, { run });


/***/ }),

/***/ 936:
/***/ ((module, exports, __nccwpck_require__) => {


// Generates the conftest configuration file the pinned evaluation runs with.
//
// Conftest loads conftest.{toml,yaml,json,...} from its working directory.
// That directory is the consumer checkout, and keys there steer the evaluation.
// An `update` key downloads over the verified policy directory before it loads.
// A `parser` key reduces the plan to nothing and `no-fail` hides violations.
// Passing this generated file to --config-file shadows every consumer file.
Object.defineProperty(exports, "__esModule", ({ value: true }));
const { writeFileSync } = __nccwpck_require__(24);
const { join } = __nccwpck_require__(760);
const ISOLATED_CONFIG_FILE = "conftest-pinned.toml";
const ISOLATED_CONFIG_CONTENT = `# Generated by pretty-good-software-org/ci-shared actions/tofu/policy.
# Intentionally empty: it shadows any conftest configuration file in the consumer
# checkout so only this action's flags decide what conftest evaluates.
`;
// The isolated file lives beside the checked-out policy, never inside it.
// Keeping it out of the policy directory keeps it out of the tree digest.
const writeIsolatedConfig = (checkoutRoot) => {
    const configFile = join(checkoutRoot, ISOLATED_CONFIG_FILE);
    writeFileSync(configFile, ISOLATED_CONFIG_CONTENT, "utf8");
    return configFile;
};
module.exports = { ISOLATED_CONFIG_FILE, writeIsolatedConfig };


/***/ }),

/***/ 59:
/***/ ((module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const { readFileSync, readdirSync } = __nccwpck_require__(24);
const { join, relative } = __nccwpck_require__(760);
const CONFTEST_FILENAME = "conftest.toml";
const FLOOR_EXEMPT_REASON_PATTERN = /^\s*floor_exempt_reason\s*=\s*["']([^"']*)["']/m;
const IGNORED_DIRECTORIES = new Set([".git", ".terraform", "node_modules", ".claude"]);
const visitDirectory = (entry, directory, root) => {
    if (IGNORED_DIRECTORIES.has(entry.name)) {
        return [];
    }
    return findConftestFiles(join(directory, entry.name), root);
};
const isConftestFile = (entry) => entry.isFile() && entry.name === CONFTEST_FILENAME;
const visitEntry = (entry, directory, root) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
        return visitDirectory(entry, directory, root);
    }
    if (!isConftestFile(entry)) {
        return [];
    }
    return [relative(root, entryPath) || CONFTEST_FILENAME];
};
const findConftestFiles = (directory, root) => readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => visitEntry(entry, directory, root))
    .toSorted();
const hasNamespace = (content) => {
    const namespaceArray = content.match(/^\s*namespace\s*=\s*\[([\s\S]*?)\]/m)?.[1] || "";
    const namespaceString = content.match(/^\s*namespace\s*=\s*["'][^"']+["']/m);
    return /["'][^"']+["']/.test(namespaceArray) || namespaceString !== null;
};
const floorExemptReason = (content) => content.match(FLOOR_EXEMPT_REASON_PATTERN)?.[1]?.trim() || "";
const findFloorExemptReason = (root) => {
    for (const file of findConftestFiles(root, root)) {
        const reason = floorExemptReason(readFileSync(join(root, file), "utf8"));
        if (reason) {
            return reason;
        }
    }
    return "";
};
const hasPolicySelectionOrExemption = (content) => hasNamespace(content) || floorExemptReason(content) !== "";
const validateConftestIntegrity = (root) => {
    const invalidFiles = findConftestFiles(root, root).filter((file) => !hasPolicySelectionOrExemption(readFileSync(join(root, file), "utf8")));
    if (invalidFiles.length === 0) {
        return "";
    }
    return `Policy integrity check failed: every conftest.toml must declare at least one namespace or a non-empty floor_exempt_reason; missing in ${invalidFiles.join(", ")}`;
};
module.exports = { findFloorExemptReason, validateConftestIntegrity };


/***/ }),

/***/ 195:
/***/ ((module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const { withPinnedPolicy } = __nccwpck_require__(972);
const { evaluatePolicy, execErrorOutput } = __nccwpck_require__(299);
// --data is added only when the pinned checkout ships a data directory.
// An older policy commit without one keeps the exact legacy command.
// The directory is always the immutable checkout's own, never a consumer path.
const dataArguments = (dataDirectory) => {
    if (!dataDirectory) {
        return [];
    }
    return ["--data", dataDirectory];
};
// Every input that decides what conftest evaluates is stated here as a flag.
// Flags outrank the configuration file and CONFTEST_* environment variables alike.
// Conftest has no flag for turning updates off.
// An empty --update is therefore what denies a CONFTEST_UPDATE download.
const commandArguments = (args, sources) => {
    const namespaceArguments = args.requiredNamespaces.flatMap((namespace) => ["--namespace", namespace]);
    const data = dataArguments(sources.dataDirectory);
    return [
        "test",
        "--config-file",
        sources.configFile,
        "--policy",
        sources.policyDirectory,
        "--update",
        "",
        ...data,
        ...namespaceArguments,
        // A parser that cannot read the plan turns it into an empty document.
        // Every policy then passes against nothing. The input is the JSON plan.
        "--parser",
        "json",
        // Without this, a run that found violations can still exit zero.
        // A zero exit is read here as a clean policy result.
        "--no-fail=false",
        // Conftest colours its summary even when stdout is not a terminal.
        // The loaded-test count is read back out of that summary.
        // Colour codes sit between the newline and the count, hiding it.
        "--no-color",
        "--quiet=false",
        args.planJson,
    ];
};
const evaluateFetchedPolicy = (args, sources) => {
    const argsForConftest = commandArguments(args, sources);
    return evaluatePolicy(argsForConftest, args.exec, args.floorExemptReason);
};
const pinnedPolicyFailure = (error) => {
    const output = execErrorOutput(error);
    if (output.startsWith("Policy integrity check failed:")) {
        return output;
    }
    return `Policy integrity check failed: pinned policy preparation failed: ${output}`;
};
const failedPinnedPolicyResult = (args, error) => ({
    floorExemptReason: args.floorExemptReason,
    hasViolations: true,
    policyIntegrityFailed: true,
    policyViolations: pinnedPolicyFailure(error),
});
const runPinnedPolicy = (args) => {
    const checkoutArgs = {
        evaluatePolicy: (sources) => evaluateFetchedPolicy(args, sources),
        exec: args.exec,
        policyRef: args.policyRef,
        requiredNamespaces: args.requiredNamespaces,
    };
    try {
        return withPinnedPolicy(checkoutArgs);
    }
    catch (error) {
        return failedPinnedPolicyResult(args, error);
    }
};
module.exports = { runPinnedPolicy };


/***/ }),

/***/ 972:
/***/ ((module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const fs = __nccwpck_require__(24);
const { mkdtempSync } = fs;
const { tmpdir } = __nccwpck_require__(161);
const { join } = __nccwpck_require__(760);
const { validateNamespaceNames, validateRequiredNamespaces } = __nccwpck_require__(631);
const { resolvePolicyDataDirectory } = __nccwpck_require__(434);
const { hashPolicyTree } = __nccwpck_require__(94);
const { writeIsolatedConfig } = __nccwpck_require__(936);
const POLICY_REPOSITORY = "ssh://git@github.com/pretty-good-software-org/opa-policies.git";
const POLICY_DIRECTORY = "policy";
const POLICY_REF_PATTERN = /^[0-9a-f]{40}$/;
const validatePolicyRefPresence = (policyRef) => {
    if (!policyRef) {
        throw new Error("Policy integrity check failed: policy-ref is required when required-namespaces is set");
    }
};
const validateNamespaceContractPresence = (requiredNamespaces) => {
    if (requiredNamespaces.length === 0) {
        throw new Error("Policy integrity check failed: required-namespaces is required when policy-ref is set");
    }
};
const validatePolicyRefFormat = (policyRef) => {
    if (!POLICY_REF_PATTERN.test(policyRef)) {
        throw new Error("Policy integrity check failed: policy-ref must be a lowercase 40-character commit SHA");
    }
};
const validatePinnedPolicyInputs = (policyRef, requiredNamespaces) => {
    validatePolicyRefPresence(policyRef);
    validateNamespaceContractPresence(requiredNamespaces);
    validatePolicyRefFormat(policyRef);
    validateNamespaceNames(requiredNamespaces);
};
const fetchPinnedPolicy = (checkoutRoot, policyRef, exec) => {
    const initializeArguments = ["init", "--quiet", checkoutRoot];
    exec("git", initializeArguments);
    const remoteArguments = ["-C", checkoutRoot, "remote", "add", "origin", POLICY_REPOSITORY];
    exec("git", remoteArguments);
    const fetchArguments = ["-C", checkoutRoot, "fetch", "--quiet", "--depth=1", "origin", policyRef];
    exec("git", fetchArguments);
    const checkoutArguments = ["-C", checkoutRoot, "checkout", "--quiet", "--detach", "FETCH_HEAD"];
    exec("git", checkoutArguments);
};
const verifyFetchedCommit = (checkoutRoot, policyRef, exec) => {
    const commandArguments = ["-C", checkoutRoot, "rev-parse", "--verify", "HEAD"];
    const fetchedCommit = exec("git", commandArguments).trim();
    if (fetchedCommit !== policyRef) {
        throw new Error("Policy integrity check failed: fetched policy commit does not match policy-ref");
    }
};
// Verifies the verified tree is still byte-identical once conftest has run.
// A replacement would mean something reached past the pinning flags.
const verifyPolicyTreeUnchanged = (policyDirectory, fetchedDigest) => {
    if (hashPolicyTree(policyDirectory) === fetchedDigest) {
        return;
    }
    throw new Error("Policy integrity check failed: the verified policy tree changed during evaluation");
};
const executePinnedPolicy = (args) => {
    fetchPinnedPolicy(args.checkoutRoot, args.policyRef, args.exec);
    verifyFetchedCommit(args.checkoutRoot, args.policyRef, args.exec);
    const policyDirectory = join(args.checkoutRoot, POLICY_DIRECTORY);
    validateRequiredNamespaces(policyDirectory, args.requiredNamespaces);
    const dataDirectory = resolvePolicyDataDirectory(args.checkoutRoot, policyDirectory);
    const configFile = writeIsolatedConfig(args.checkoutRoot);
    const fetchedDigest = hashPolicyTree(policyDirectory);
    const result = args.evaluatePolicy({ configFile, dataDirectory, policyDirectory });
    verifyPolicyTreeUnchanged(policyDirectory, fetchedDigest);
    return result;
};
const errorMessage = (error) => {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error || "unknown error");
};
const removeCheckout = (checkoutRoot) => {
    try {
        const cleanupOptions = { force: true, recursive: true };
        fs.rmSync(checkoutRoot, cleanupOptions);
    }
    catch (error) {
        throw new Error(`Policy checkout cleanup failed: ${errorMessage(error)}`, { cause: error });
    }
};
const removeCheckoutBestEffort = (checkoutRoot) => {
    try {
        removeCheckout(checkoutRoot);
    }
    catch (error) {
        console.error(errorMessage(error));
    }
};
const withPinnedPolicy = (args) => {
    validatePinnedPolicyInputs(args.policyRef, args.requiredNamespaces);
    const checkoutRoot = mkdtempSync(join(tmpdir(), "ci-shared-opa-policies-"));
    const executionArgs = { ...args, checkoutRoot };
    try {
        return executePinnedPolicy(executionArgs);
    }
    finally {
        removeCheckoutBestEffort(checkoutRoot);
    }
};
module.exports = { withPinnedPolicy };


/***/ }),

/***/ 434:
/***/ ((module, exports, __nccwpck_require__) => {


// Resolves the canonical policy/data directory inside the pinned checkout.
// Conftest does not auto-load data from --policy or the working directory.
// The pinned runner must therefore pass this directory explicitly with --data.
// Only the immutable checkout's own directory is used, never a consumer path.
// The path is guarded against symlink and traversal escapes below.
Object.defineProperty(exports, "__esModule", ({ value: true }));
const fs = __nccwpck_require__(24);
const { isAbsolute, join, relative } = __nccwpck_require__(760);
const POLICY_DATA_DIRECTORY = "data";
const integrityError = (message) => new Error(`Policy integrity check failed: ${message}`);
// True when the resolved data path is a strict descendant of the checkout root.
// Equal paths and any escaping path (starting with "..", or absolute) fail.
const isWithinRoot = (realRoot, realData) => {
    const rel = relative(realRoot, realData);
    return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
};
// Validates the candidate's real, symlink-resolved location.
// It must be a directory strictly inside the checkout root.
// Any escape or non-directory throws a policy-integrity error.
const assertDataDirectoryContained = (checkoutRoot, candidate) => {
    const realRoot = fs.realpathSync(checkoutRoot);
    const realData = fs.realpathSync(candidate);
    if (!isWithinRoot(realRoot, realData)) {
        throw integrityError("policy data directory resolves outside the policy checkout");
    }
    if (!fs.statSync(realData).isDirectory()) {
        throw integrityError("policy data path is not a directory");
    }
};
// Returns the checkout-relative policy/data path to pass to --data.
// Returns undefined when the checkout ships no data directory.
// That covers older pinned commits and stays backward compatible.
// The returned path is the plain join path, matching the --policy argument.
const resolvePolicyDataDirectory = (checkoutRoot, policyDirectory) => {
    const candidate = join(policyDirectory, POLICY_DATA_DIRECTORY);
    if (!fs.existsSync(candidate)) {
        return undefined;
    }
    assertDataDirectoryContained(checkoutRoot, candidate);
    return candidate;
};
module.exports = { resolvePolicyDataDirectory };


/***/ }),

/***/ 677:
/***/ ((module, exports) => {


// Refuses to evaluate policy with conftest settings inherited from the environment.
//
// Viper reads CONFTEST_* variables ahead of any configuration file.
// The isolated configuration file therefore cannot shadow them.
// Naming the dangerous ones as flags would be a deny-list, and conftest gains settings.
// The action's inputs are authoritative instead.
// Any inherited CONFTEST_* variable fails the run closed, including unknown ones.
Object.defineProperty(exports, "__esModule", ({ value: true }));
const CONFTEST_ENVIRONMENT_PREFIX = "CONFTEST_";
const conftestEnvironmentNames = (env) => Object.keys(env)
    .filter((name) => name.startsWith(CONFTEST_ENVIRONMENT_PREFIX))
    .toSorted();
const conftestEnvironmentFailure = (env) => {
    const names = conftestEnvironmentNames(env);
    if (names.length === 0) {
        return "";
    }
    return `Policy integrity check failed: refusing to evaluate policy with conftest settings from the environment: ${names.join(", ")}`;
};
module.exports = { conftestEnvironmentFailure };


/***/ }),

/***/ 631:
/***/ ((module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const { readFileSync, readdirSync } = __nccwpck_require__(24);
const { join } = __nccwpck_require__(760);
const NAMESPACE_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const PACKAGE_PATTERN = /^\s*package\s+([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*(?:#.*)?$/gm;
const parseRequiredNamespaces = (input) => [
    ...new Set(input
        .split(/\r?\n/)
        .map((namespace) => namespace.trim())
        .filter(Boolean)),
];
const validateNamespaceNames = (requiredNamespaces) => {
    const invalidNamespace = requiredNamespaces.find((namespace) => !NAMESPACE_PATTERN.test(namespace));
    if (invalidNamespace) {
        throw new Error("Policy integrity check failed: required-namespaces contains an invalid Rego package name");
    }
};
const findPolicyFiles = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
        return findPolicyFiles(entryPath);
    }
    if (!entry.isFile() || !entry.name.endsWith(".rego") || entry.name.endsWith("_test.rego")) {
        return [];
    }
    return [entryPath];
});
const packageNames = (policyDirectory) => {
    const packages = new Set();
    for (const policyFile of findPolicyFiles(policyDirectory)) {
        const source = readFileSync(policyFile, "utf8");
        for (const match of source.matchAll(PACKAGE_PATTERN)) {
            packages.add(match[1]);
        }
    }
    return packages;
};
const validateRequiredNamespaces = (policyDirectory, requiredNamespaces) => {
    const availableNamespaces = packageNames(policyDirectory);
    const missingNamespaces = requiredNamespaces.filter((namespace) => !availableNamespaces.has(namespace));
    if (missingNamespaces.length > 0) {
        throw new Error(`Policy integrity check failed: fetched policy commit is missing required namespaces: ${missingNamespaces.join(", ")}`);
    }
};
module.exports = { parseRequiredNamespaces, validateNamespaceNames, validateRequiredNamespaces };


/***/ }),

/***/ 299:
/***/ ((module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const MINIMUM_POLICY_TESTS = 5;
const POLICY_SUMMARY_PATTERN = /(?:^|\n)\s*(\d+) tests?,/;
const policyIntegrityFailure = (output, floorExemptReason) => {
    const summary = output.match(POLICY_SUMMARY_PATTERN);
    if (!summary) {
        return "Policy integrity check failed: conftest did not report a loaded-test count; refusing to trust the policy result";
    }
    const loadedTestCount = Number(summary[1]);
    if (!floorExemptReason && loadedTestCount < MINIMUM_POLICY_TESTS) {
        return `Policy integrity check failed: conftest loaded ${loadedTestCount} tests; require at least ${MINIMUM_POLICY_TESTS}`;
    }
    return "";
};
const successfulPolicyResult = (output, floorExemptReason) => {
    const integrityFailure = policyIntegrityFailure(output, floorExemptReason);
    if (integrityFailure) {
        return {
            floorExemptReason,
            hasViolations: true,
            policyIntegrityFailed: true,
            policyViolations: integrityFailure,
        };
    }
    return {
        floorExemptReason,
        hasViolations: false,
        policyIntegrityFailed: false,
        policyViolations: "",
    };
};
const execErrorOutput = (error) => {
    const execError = error;
    return (execError.stdout || "") + (execError.stderr || "") || execError.message || "unknown error";
};
const evaluatePolicy = (args, exec, floorExemptReason) => {
    try {
        const output = exec("conftest", args);
        return successfulPolicyResult(output, floorExemptReason);
    }
    catch (error) {
        return {
            floorExemptReason,
            hasViolations: true,
            policyIntegrityFailed: false,
            policyViolations: execErrorOutput(error),
        };
    }
};
module.exports = { evaluatePolicy, execErrorOutput };


/***/ }),

/***/ 94:
/***/ ((module, exports, __nccwpck_require__) => {


// Digests the verified policy tree so evaluation can be proven to have used it.
// The pinning flags are the enforcement; this digest is the proof.
// Symlinks are digested by their target text and never followed.
// Following one would let a planted link pull host files into the digest.
// Paths are digested relative to the tree root and file bodies as raw bytes.
// The digest therefore describes the tree itself, not where it was checked out.
Object.defineProperty(exports, "__esModule", ({ value: true }));
const { createHash } = __nccwpck_require__(598);
const { readFileSync, readdirSync, readlinkSync } = __nccwpck_require__(24);
const { join, relative } = __nccwpck_require__(760);
// Each part is length-prefixed so no file body can imitate the next entry's header.
const digestPart = (digest, label, value) => {
    digest.update(`${label}:${value.length}:`);
    digest.update(value);
};
const digestContent = (context, path, entry) => {
    if (entry.isSymbolicLink()) {
        // A link target is an arbitrary byte string, so it is read as bytes.
        // Decoding it as text would collapse distinct targets onto one digest.
        digestPart(context.digest, "symlink", readlinkSync(path, "buffer"));
        return;
    }
    if (entry.isFile()) {
        digestPart(context.digest, "file", readFileSync(path));
        return;
    }
    digestPart(context.digest, "other", "");
};
const digestEntry = (context, directory, entry) => {
    const path = join(directory, entry.name);
    digestPart(context.digest, "path", relative(context.root, path));
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
        digestPart(context.digest, "directory", "");
        digestDirectory(context, path);
        return;
    }
    digestContent(context, path, entry);
};
const byName = (left, right) => left.name.localeCompare(right.name);
const digestDirectory = (context, directory) => {
    const entries = readdirSync(directory, { withFileTypes: true }).toSorted(byName);
    entries.forEach((entry) => digestEntry(context, directory, entry));
};
// Returns a stable digest over every relative path, file body and link target.
const hashPolicyTree = (policyDirectory) => {
    const digest = createHash("sha256");
    digestDirectory({ digest, root: policyDirectory }, policyDirectory);
    return digest.digest("hex");
};
module.exports = { hashPolicyTree };


/***/ }),

/***/ 6:
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

/***/ 96:
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

/***/ 421:
/***/ ((module) => {

module.exports = require("node:child_process");

/***/ }),

/***/ 598:
/***/ ((module) => {

module.exports = require("node:crypto");

/***/ }),

/***/ 24:
/***/ ((module) => {

module.exports = require("node:fs");

/***/ }),

/***/ 161:
/***/ ((module) => {

module.exports = require("node:os");

/***/ }),

/***/ 760:
/***/ ((module) => {

module.exports = require("node:path");

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
/******/ 	var __webpack_exports__ = __nccwpck_require__(673);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;