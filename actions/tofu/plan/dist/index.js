/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 869:
/***/ ((module, exports, __nccwpck_require__) => {


// Create OpenTofu plan and capture outputs.
//
// Orchestration entry point — delegates plan execution to run.ts,
// Writes GitHub Actions outputs.
Object.defineProperty(exports, "__esModule", ({ value: true }));
const { writeFileSync } = __nccwpck_require__(24);
const { execCapture } = __nccwpck_require__(361);
const { resolveOutputWriter } = __nccwpck_require__(1);
const { MAX_PLAN_LENGTH, run } = __nccwpck_require__(758);
const resolveMainArgs = (args) => ({
    env: args.env || process.env,
    exec: args.exec || execCapture,
    write: args.write || writeFileSync,
});
const main = async (args = {}) => {
    const { env, exec, write } = resolveMainArgs(args);
    const workingDirectory = env.INPUT_WORKING_DIRECTORY || "tofu";
    const varFile = env.INPUT_VAR_FILE || "";
    const result = run({ workingDirectory, varFile }, exec, write);
    const setOutput = resolveOutputWriter(args);
    setOutput("plan", result.plan);
    setOutput("plan-file", result.planFile);
    setOutput("plan-json", result.planJson);
};
module.exports = Object.assign(main, { MAX_PLAN_LENGTH, run });


/***/ }),

/***/ 758:
/***/ ((module, exports, __nccwpck_require__) => {


// Execute tofu plan and capture outputs.
//
// 1. Runs tofu plan -no-color -out=plan.tfplan [-var-file=...]
// 2. Captures text output via tofu show, truncated to 60k chars
// 3. Exports JSON plan to plan.json
Object.defineProperty(exports, "__esModule", ({ value: true }));
const { writeFileSync } = __nccwpck_require__(24);
const { execCapture } = __nccwpck_require__(361);
const MAX_PLAN_LENGTH = 60_000;
const truncatePlan = (text) => {
    if (text.length > MAX_PLAN_LENGTH) {
        return `${text.substring(0, MAX_PLAN_LENGTH)}\n... (truncated)`;
    }
    return text;
};
const run = ({ workingDirectory, varFile }, exec = execCapture, write = writeFileSync) => {
    if (workingDirectory.includes("..")) {
        throw new Error(`working directory must not contain path traversal: ${workingDirectory}`);
    }
    if (varFile && varFile.includes("..")) {
        throw new Error(`var-file must not contain path traversal: ${varFile}`);
    }
    const planArgs = [`-chdir=${workingDirectory}`, "plan", "-no-color", "-out=plan.tfplan"];
    if (varFile) {
        planArgs.push(`-var-file=${varFile}`);
    }
    exec("tofu", planArgs);
    const planText = exec("tofu", [`-chdir=${workingDirectory}`, "show", "-no-color", "plan.tfplan"]);
    const planJsonOutput = exec("tofu", [`-chdir=${workingDirectory}`, "show", "-json", "plan.tfplan"]);
    const planJsonPath = `${workingDirectory}/plan.json`;
    write(planJsonPath, planJsonOutput);
    return {
        plan: truncatePlan(planText),
        planFile: `${workingDirectory}/plan.tfplan`,
        planJson: planJsonPath,
    };
};
module.exports = { MAX_PLAN_LENGTH, run };


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
/******/ 	var __webpack_exports__ = __nccwpck_require__(869);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;