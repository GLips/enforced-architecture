// FIRES barrel-purity: the chain whose middle hop is written as an ALIAS.
//
// index.ts → controllers/runtime.ts → @/shared/lib/host-fingerprint.ts →
// "node:os". Only the first hop is relative. A trace that follows `./…` and
// stops at `@/…` ends inside the feature and reports this barrel clean, while
// every hop it skipped is a real edge — an alias is the same edge spelled
// differently, and the aliased spelling is the one the boundary rules REQUIRE
// for a crossing, so it is the spelling a real chain leaves the feature in.
export { describeRuntime } from "./controllers/runtime.ts";
