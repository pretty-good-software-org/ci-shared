/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 294:
/***/ ((module, exports, __nccwpck_require__) => {


// Validate OpenTofu configuration.
//
// Runs tofu validate against the working directory.
Object.defineProperty(exports, "__esModule", ({ value: true }));
const { execStream } = __nccwpck_require__(361);
const run = ({ workingDirectory }, exec = execStream) => {
    exec("tofu", [`-chdir=${workingDirectory}`, "validate"]);
};
const main = ({ env = process.env, exec = execStream } = {}) => {
    const workingDirectory = env.INPUT_WORKING_DIRECTORY || "tofu";
    run({ workingDirectory }, exec);
};
module.exports = Object.assign(main, { run });


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
/******/ 	var __webpack_exports__ = __nccwpck_require__(294);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;