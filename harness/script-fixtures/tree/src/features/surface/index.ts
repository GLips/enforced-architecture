// FIRES barrel-discoverability four times, once per branch, on four separate
// lines. The count is the assertion: a check that catches one shape and not the
// rest still reports this file, so only the number of findings tells them apart
// — which is why every one of the four is declared under a single kind, and why
// the plain-wildcard case lives in its own barrel under `features/gateway`.
//
// The first line is the violation the doc names. The other three are what a
// matcher written from that doc loses:
//
//   - `export * as ns from` is not `export * from`. A pattern anchored on
//     `* from` walks straight past it while reporting its neighbour, and a
//     namespace re-export hides exactly as many names.
//   - a renamed re-export is a `{ … }` list — a different statement shape
//     entirely. Miss it and every aliased public name in the repo goes
//     unreported while the barrel still looks audited.
//   - `export type { X as Y }` is the same list behind a `type` modifier, and
//     the branch that decides whether it counts is a config knob. Nothing else
//     in the tree exercises `flagTypeAliases`.
export * from "./service/surface-registry.ts";
export * as surfaceClient from "./service/surface-client.ts";
export { createClient as createSurfaceClient } from "./service/surface-client.ts";
export type { RegistryEntry as SurfaceRegistryEntry } from "./service/surface-registry.ts";
