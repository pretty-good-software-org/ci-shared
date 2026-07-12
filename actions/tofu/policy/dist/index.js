/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 486:
/***/ ((module, exports, __nccwpck_require__) => {


// Run Conftest policy checks against an OpenTofu plan.
//
// 1. Runs conftest test against the JSON plan file
// 2. Sets has_violations and policy_violations outputs
Object.defineProperty(exports, "__esModule", ({ value: true }));
const { execCapture } = __nccwpck_require__(361);
const { resolveOutputWriter } = __nccwpck_require__(1);
const { findFloorExemptReason, validateConftestIntegrity } = __nccwpck_require__(984);
const MINIMUM_POLICY_TESTS = 5;
const POLICY_REPOSITORY = "git::ssh://git@github.com/pretty-good-software-org/opa-policies.git//policy";
const POLICY_SUMMARY_PATTERN = /(?:^|\n)\s*(\d+) tests?,/;
const policyIntegrityFailure = (output, floorExemptReason = "") => {
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
const successfulPolicyResult = (output, floorExemptReason = "") => {
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
const runPolicyTest = (planJson, exec, floorExemptReason = "") => {
    try {
        const output = exec("conftest", ["test", "--quiet=false", planJson]);
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
const run = ({ planJson, cwd = process.cwd() }, exec = execCapture) => {
    const configIntegrityFailure = validateConftestIntegrity(cwd);
    if (configIntegrityFailure) {
        return {
            floorExemptReason: "",
            hasViolations: true,
            policyIntegrityFailed: true,
            policyViolations: configIntegrityFailure,
        };
    }
    const floorExemptReason = findFloorExemptReason(cwd);
    try {
        exec("conftest", ["pull", POLICY_REPOSITORY]);
    }
    catch (error) {
        return {
            floorExemptReason,
            hasViolations: true,
            policyIntegrityFailed: true,
            policyViolations: `Policy integrity check failed: conftest pull failed: ${execErrorOutput(error)}`,
        };
    }
    return runPolicyTest(planJson, exec, floorExemptReason);
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
    const planJson = env.INPUT_PLAN_JSON || "tofu/plan.json";
    const result = run({ cwd: args.cwd, planJson }, exec);
    logFloorExemption(result.floorExemptReason, resolveWarningLogger(args.logWarning));
    const setOutput = resolveOutputWriter(args);
    setOutput("has_violations", String(result.hasViolations));
    setOutput("policy_violations", result.policyViolations);
    enforcePolicyIntegrity(result);
};
module.exports = Object.assign(main, { run });


/***/ }),

/***/ 984:
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
/******/ 	var __webpack_exports__ = __nccwpck_require__(486);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;