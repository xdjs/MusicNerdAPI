/** Fail closed if an unexpected AI boundary is reached in an isolated test build. */
export function denyProvider(): never {
  throw new Error("Provider calls are forbidden in the deterministic About test build");
}
