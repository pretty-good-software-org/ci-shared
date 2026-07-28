/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 937:
/***/ ((module, exports, __nccwpck_require__) => {


// Build OpenTofu plan details as a collapsible markdown fragment.
//
// Pure markdown builder — no GitHub API calls.
// Reads plan text from INPUT_PLAN environment variable.
// Builds a collapsible details block and sets the plan-details output.
Object.defineProperty(exports, "__esModule", ({ value: true }));
const { resolveOutputWriter } = __nccwpck_require__(1);
const { buildPlanDetails } = __nccwpck_require__(804);
const { parseEnv } = __nccwpck_require__(950);
const main = async (args = {}) => {
    const env = args.env || process.env;
    const detailsArgs = parseEnv(env);
    const body = buildPlanDetails(detailsArgs);
    const setOutput = resolveOutputWriter(args);
    setOutput("plan-details", body);
};
module.exports = Object.assign(main, { buildPlanDetails, parseEnv });


/***/ }),

/***/ 804:
/***/ ((module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const buildPlanDetails = (args) => {
    const plan = (args.plan ?? "").replace(/```/g, "` ` `");
    return ["<details><summary>Show Plan</summary>", "", "```terraform", plan, "```", "", "</details>"].join("\n");
};
module.exports = { buildPlanDetails };


/***/ }),

/***/ 950:
/***/ ((module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
const parseEnv = (env) => ({
    plan: env.INPUT_PLAN ?? "",
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
/******/ 	var __webpack_exports__ = __nccwpck_require__(937);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;