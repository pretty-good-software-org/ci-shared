/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 909:
/***/ ((module, exports, __nccwpck_require__) => {


// Configure npm auth for private GitHub Packages using a GitHub App installation token.
//
// Writes ~/.npmrc mapping the given scope's registry to npm.pkg.github.com.
// Also exports NODE_AUTH_TOKEN for install steps (e.g. bun install, npm ci) that read the token from the environment.
Object.defineProperty(exports, "__esModule", ({ value: true }));
const { writeFileSync } = __nccwpck_require__(24);
const { homedir } = __nccwpck_require__(161);
const path = __nccwpck_require__(760);
const buildNpmrc = ({ scope, token }) => [`${scope}:registry=https://npm.pkg.github.com`, `//npm.pkg.github.com/:_authToken=${token}`, ""].join("\n");
const run = (args, write = writeFileSync, npmrcPath = path.join(homedir(), ".npmrc")) => {
    write(npmrcPath, buildNpmrc(args));
};
const resolveToken = (env) => {
    const token = env.INPUT_TOKEN || "";
    if (!token) {
        throw new Error("INPUT_TOKEN is required — did the create-github-app-token step run?");
    }
    return token;
};
const main = ({ core, env = process.env, write = writeFileSync, }) => {
    const scope = env.INPUT_SCOPE || "@pretty-good-software-org";
    const token = resolveToken(env);
    run({ scope, token }, write);
    core.exportVariable("NODE_AUTH_TOKEN", token);
};
module.exports = Object.assign(main, { buildNpmrc, run });


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
/******/ 	var __webpack_exports__ = __nccwpck_require__(909);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;