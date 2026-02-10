const { execCapture } = require("../../../lib/exec.ts");

type ExecFn = typeof execCapture;
type WriteFn = (path: string, data: string) => void;

module.exports = {};
export type { ExecFn, WriteFn };
