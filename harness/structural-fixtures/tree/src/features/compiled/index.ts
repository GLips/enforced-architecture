// LEGAL for barrel-purity, and legal is the whole assertion: the hop is spelled
// `./service/rates.js` and BOTH `rates.ts` and `rates.js` are on disk. The
// TypeScript source is clean; the compiled artefact beside it reaches
// `postgres`.
//
// `extensionAlias` is an ORDERED list, and this pair is what makes the order
// load-bearing: source extensions first and the emitted one last, so a build
// step that left its output in the tree cannot change which module the graph
// says an import lands on. Reverse it and this barrel reports a finding against
// a chain the compiler never builds.
export { rate } from "./service/rates.js";
