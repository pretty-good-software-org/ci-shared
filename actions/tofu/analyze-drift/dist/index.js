/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 998:
/***/ ((module, exports, __nccwpck_require__) => {


// Analyze OpenTofu plan JSON for infrastructure drift.
//
// Pure JSON parser + markdown builder — no GitHub API calls.
// Reads plan JSON from INPUT_PLAN_JSON environment variable.
// Detects resource changes and builds a drift summary markdown fragment.
Object.defineProperty(exports, "__esModule", ({ value: true }));
const { resolveOutputWriter } = __nccwpck_require__(1);
const { analyzeDrift } = __nccwpck_require__(744);
const { parseEnv } = __nccwpck_require__(471);
const main = async (args = {}) => {
    const env = args.env || process.env;
    const driftArgs = parseEnv(env);
    const result = analyzeDrift(driftArgs);
    const setOutput = resolveOutputWriter(args);
    setOutput("has-drift", String(result.hasDrift));
    setOutput("drift-summary", result.summary);
};
module.exports = Object.assign(main, { analyzeDrift, parseEnv });


/***/ }),

/***/ 744:
/***/ ((module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const incomplete = (reason) => ({
    hasDrift: false,
    summary: ["### Drift Detection Incomplete", "", reason].join("\n"),
});
const noDrift = () => ({
    hasDrift: false,
    summary: ["### No Drift Detected", "", "All resources match their expected state."].join("\n"),
});
const driftFound = (addresses) => ({
    hasDrift: true,
    summary: [
        "### Drift Detected",
        "",
        "The following resources have drifted from their expected state:",
        "",
        "```",
        ...addresses,
        "```",
        "",
        "**Action Required**: Review and reconcile drift",
    ].join("\n"),
});
const parsePlanJson = (raw) => {
    try {
        return JSON.parse(raw);
    }
    catch {
        return undefined;
    }
};
const isNoOp = (rc) => rc.change.actions.every((action) => action === "no-op");
const findDriftedAddresses = (raw) => {
    const plan = parsePlanJson(raw);
    if (!plan) {
        return undefined;
    }
    return (plan.resource_changes ?? []).filter((rc) => !isNoOp(rc)).map((rc) => rc.address);
};
const analyzeDrift = (args) => {
    const raw = (args.planJson ?? "").trim();
    if (!raw) {
        return incomplete("Plan JSON was not provided.");
    }
    const drifted = findDriftedAddresses(raw);
    if (!drifted) {
        return incomplete("Plan JSON could not be parsed.");
    }
    if (drifted.length === 0) {
        return noDrift();
    }
    return driftFound(drifted);
};
module.exports = { analyzeDrift };


/***/ }),

/***/ 471:
/***/ ((module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const parseEnv = (env) => ({
    planJson: env.INPUT_PLAN_JSON,
});
module.exports = { parseEnv };


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
/******/ 	var __webpack_exports__ = __nccwpck_require__(998);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;