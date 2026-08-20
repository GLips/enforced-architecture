// LEGAL: two files sitting directly in src/ importing each other. They must
// stay silent.
//
// A file at the source root has no directory component, so an implementation
// that takes "the first path segment" as the boundary reads `client` and
// `router` as two different boundaries and calls this a crossing.
// The source root is ONE unit, and these are two of the entrypoints
// `sourceRootModules()` derives in lint/policy/layout.ts — the standard layout's
// own names, because the policy reads the tree's vocabulary rather than a config
// key and a fixture tree cannot override it.
//
// This bug was latent in the fodmap implementation this check descends from,
// where no top-level src/ file existed to expose it.
export { rootThing } from "./router.tsx";
