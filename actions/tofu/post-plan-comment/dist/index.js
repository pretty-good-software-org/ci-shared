/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 604:
/***/ ((module, exports) => {


// Post OpenTofu plan results as a PR comment.
// Used by actions/github-script in plan.yml.
//
// Reads step outcomes and plan output from environment variables,
// Builds a markdown comment, and creates or updates the PR comment.
Object.defineProperty(exports, "__esModule", ({ value: true }));
const BOT_COMMENT_IDENTIFIER = "### OpenTofu Plan Results";
const buildComment = (args) => {
    const { actor, fmtOutcome, hasViolations, initOutcome, plan, planOutcome, validateOutcome } = args;
    let policyStatus = "PASSED";
    if (hasViolations) {
        policyStatus = "FAILED";
    }
    let policyMessage = "All policies passed";
    if (hasViolations) {
        policyMessage = "**Policy Violations:** See Conftest step output for details";
    }
    return [
        "### OpenTofu Plan Results",
        `#### Format Check: \`${fmtOutcome}\``,
        `#### Init: \`${initOutcome}\``,
        `#### Validate: \`${validateOutcome}\``,
        `#### Plan: \`${planOutcome}\``,
        "<details><summary>Show Plan</summary>",
        "",
        "```terraform",
        plan,
        "```",
        "",
        "</details>",
        `#### Conftest Policy Check: \`${policyStatus}\``,
        policyMessage,
        `*Pushed by: @${actor}*`,
    ].join("\n");
};
const postComment = async ({ body, context, github }) => {
    const { owner, repo } = context.repo;
    const issueNumber = context.issue.number;
    const { data: comments } = await github.rest.issues.listComments({
        issue_number: issueNumber,
        owner,
        repo,
    });
    const existing = comments.find((comment) => comment.body?.startsWith(BOT_COMMENT_IDENTIFIER));
    if (existing) {
        await github.rest.issues.updateComment({
            body,
            comment_id: existing.id,
            owner,
            repo,
        });
    }
    else {
        await github.rest.issues.createComment({
            body,
            issue_number: issueNumber,
            owner,
            repo,
        });
    }
};
const main = async ({ context, env = process.env, github }) => {
    const body = buildComment({
        actor: env.ACTOR,
        fmtOutcome: env.FMT_OUTCOME,
        hasViolations: env.HAS_VIOLATIONS === "true",
        initOutcome: env.INIT_OUTCOME,
        plan: env.PLAN || "",
        planOutcome: env.PLAN_OUTCOME,
        validateOutcome: env.VALIDATE_OUTCOME,
    });
    await postComment({ body, context, github });
};
module.exports = Object.assign(main, { BOT_COMMENT_IDENTIFIER, buildComment, postComment });


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
/******/ 	var __webpack_exports__ = __nccwpck_require__(604);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;