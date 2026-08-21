// FIRES import-policy: the `typeof import(…)` spelling of a type-position
// import, which is how a module's whole shape is named. Same blind spot as
// type-position-crossing.ts, different syntax, and both are ordinary in a
// codebase that types its own modules.
type BetaModule = typeof import("../../beta/service/beta-thing.ts");

export const readBeta = (module: BetaModule): string => module.betaThing;
