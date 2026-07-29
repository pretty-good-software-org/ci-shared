// Refuses to evaluate policy with conftest settings inherited from the environment.
//
// Viper reads CONFTEST_* variables ahead of any configuration file.
// The isolated configuration file therefore cannot shadow them.
// Naming the dangerous ones as flags would be a deny-list, and conftest gains settings.
// The action's inputs are authoritative instead.
// Any inherited CONFTEST_* variable fails the run closed, including unknown ones.

const CONFTEST_ENVIRONMENT_PREFIX = "CONFTEST_";

// Windows resolves environment names case-insensitively.
// Viper reads a lowercase conftest_parser there.
// An uppercase-only filter would miss it, so either case is matched.
const conftestEnvironmentNames = (env: NodeJS.ProcessEnv): string[] =>
  Object.keys(env)
    .filter((name: string) => name.toUpperCase().startsWith(CONFTEST_ENVIRONMENT_PREFIX))
    .toSorted();

const conftestEnvironmentFailure = (env: NodeJS.ProcessEnv): string => {
  const names = conftestEnvironmentNames(env);
  if (names.length === 0) {
    return "";
  }

  return `Policy integrity check failed: refusing to evaluate policy with conftest settings from the environment: ${names.join(", ")}`;
};

module.exports = { conftestEnvironmentFailure };
