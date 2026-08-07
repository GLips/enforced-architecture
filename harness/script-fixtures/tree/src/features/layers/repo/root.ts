// FIRES layer-direction: the same-feature upward import written as an ALIAS.
//
// A relative-only matcher is silent on it — there is no `../` to key on — and
// the aliased spelling is the one a project's own conventions encourage, so it
// is the form an upward edge is most likely to survive review in. Resolution
// makes the two spellings one edge, which is the whole reason this check reads
// the graph instead of the text.
export { handleRequest } from "@/features/layers/controllers/handlers.ts";
