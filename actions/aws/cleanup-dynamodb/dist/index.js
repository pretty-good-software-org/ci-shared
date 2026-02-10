/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 986:
/***/ ((module, exports, __nccwpck_require__) => {


// Delete DynamoDB tables matching a prefix.
//
// Lists all tables, filters by prefix, and deletes each match.
Object.defineProperty(exports, "__esModule", ({ value: true }));
const { execCapture } = __nccwpck_require__(361);
const { listTables } = __nccwpck_require__(692);
const MIN_PREFIX_LENGTH = 5;
const run = ({ prefix, region }, exec = execCapture) => {
    const tables = listTables(prefix, region, exec);
    const failed = [];
    for (const table of tables) {
        try {
            exec("aws", ["dynamodb", "delete-table", "--table-name", table, "--region", region]);
        }
        catch {
            failed.push(table);
        }
    }
    if (failed.length > 0) {
        throw new Error(`Failed to delete ${failed.length} table(s): ${failed.join(", ")}`);
    }
    return tables;
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
    if (!/^[a-z]{2}-[a-z]+-\d+$/.test(region)) {
        throw new Error(`Invalid AWS region: ${region}`);
    }
    return { prefix, region };
};
const main = (args = {}) => {
    const env = args.env || process.env;
    const runArgs = parseRunArgs(env);
    const deleted = run(runArgs, args.exec || execCapture);
    for (const table of deleted) {
        console.log(`Deleted table: ${table}`);
    }
};
module.exports = Object.assign(main, { listTables, run });


/***/ }),

/***/ 692:
/***/ ((module, exports, __nccwpck_require__) => {


// List DynamoDB tables matching a prefix with pagination.
Object.defineProperty(exports, "__esModule", ({ value: true }));
const { execCapture } = __nccwpck_require__(361);
const fetchTablePage = (region, startTable, exec) => {
    const args = ["dynamodb", "list-tables", "--region", region, "--output", "json"];
    if (startTable) {
        args.push("--exclusive-start-table-name", startTable);
    }
    return JSON.parse(exec("aws", args));
};
const listTables = (prefix, region, exec = execCapture) => {
    const tables = [];
    let startTable = undefined;
    for (;;) {
        const page = fetchTablePage(region, startTable, exec);
        tables.push(...(page.TableNames || []).filter((name) => name.startsWith(prefix)));
        if (!page.LastEvaluatedTableName) {
            break;
        }
        startTable = page.LastEvaluatedTableName;
    }
    return tables;
};
module.exports = { listTables };


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
const execCapture = (bin, args) => {
    console.log(`+ ${bin} ${args.join(" ")}`);
    try {
        const output = execFileSync(bin, args, { encoding: "utf8", stdio: "pipe" });
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
/******/ 	var __webpack_exports__ = __nccwpck_require__(986);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;