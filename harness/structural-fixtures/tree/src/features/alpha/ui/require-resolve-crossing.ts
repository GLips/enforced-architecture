// FIRES import-policy: a sibling-feature crossing written as `require.resolve`.
//
// The bare `require(…)` next door is an Identifier callee; this one is a member
// expression, and it is a SEPARATE test in the scanner — drop it and the two
// forms stop agreeing about what an import is while `wrapped-require-crossing.ts`
// keeps passing. A path resolved at build time couples the two features exactly
// as loading the module does: the specifier is the same, the boundary is the
// same, and the file it names has to be there.
export function betaThingModulePath(): string {
  const found = require.resolve("../../beta/service/beta-thing.ts");
  return found;
}
