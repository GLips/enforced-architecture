// LEGAL: two files sitting directly in src/ importing each other. They must
// stay silent.
//
// A file at the source root has no directory component, so an implementation
// that takes "the first path segment" as the boundary reads `entry-neighbour`
// and `root-neighbour` as two different boundaries and calls this a crossing.
// The source root is ONE boundary; the real repo has client.tsx, router.tsx and
// start.ts there, importing each other exactly like this.
//
// This bug was latent in the fodmap implementation this check descends from,
// where no top-level src/ file existed to expose it.
export { rootThing } from "./root-neighbour.ts";
