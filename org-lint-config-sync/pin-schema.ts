export type Reporter = (reason: string) => never;

export interface FieldSpec {
  allowed: string[];
  label: string;
}

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

const makeReporter =
  (pinPath: string): Reporter =>
  (reason: string) => {
    throw new Error(`validate org-lint-config pin ${pinPath}: ${reason}`);
  };

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const assertExactKeys = (report: Reporter, spec: FieldSpec, value: Record<string, unknown>): void => {
  const keys = Object.keys(value);
  const unknown = keys.filter((key) => !spec.allowed.includes(key));
  const missing = spec.allowed.filter((key) => !keys.includes(key));
  if (unknown.length > 0) {
    report(`${spec.label} has unknown field(s): ${unknown.join(", ")}`);
  }
  if (missing.length > 0) {
    report(`${spec.label} is missing field(s): ${missing.join(", ")}`);
  }
};

const assertNonEmptyString = (report: Reporter, label: string, value: unknown): string => {
  if (typeof value !== "string" || value.length === 0) {
    report(`${label} must be a non-empty string`);
  }
  return value as string;
};

const assertSha256 = (report: Reporter, label: string, value: unknown): string => {
  const stringValue = assertNonEmptyString(report, label, value);
  if (!/^[0-9a-f]{64}$/.test(stringValue)) {
    report(`${label} must be a 64-character lowercase hex SHA-256, got ${JSON.stringify(stringValue)}`);
  }
  return stringValue;
};

module.exports = { assertExactKeys, assertNonEmptyString, assertSha256, errorMessage, isPlainObject, makeReporter };
