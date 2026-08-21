// LEGAL-BY-SCOPING, twice, and the two spellings are two guards.
//
// Both specifiers land on a real file OUTSIDE this tree's source root — the
// vendor directory beside it, the shape hoisting and vendoring produce. An edge
// leaving the tree is not in the tree's graph, exactly as a bare package
// specifier is not, and `module-resolution.ts` refuses each spelling in a
// different place: the aliased one never reaches the resolver, because the
// CLAIM already climbs out; the relative one resolves fine and is refused on
// what it resolved TO.
//
// The third specifier is what separates them. It climbs out and resolves to
// NOTHING, so the resolved test never sees it — drop the claim test alone and
// the graph gains an edge whose target starts with `..`, which is a position
// outside the tree that the tier has no vocabulary for.
//
// No CHECK notices any of the three either way: a target starting with `..`
// classifies as `neither`, and every rule here loses interest. The
// `<import-graph>` assertion in the fixture runner is what holds them down.
import { escaped } from "@/../vendor/escaping-target/index.ts";
import { escapedAgain } from "../../../../vendor/escaping-target/index.ts";
import { neverBuilt } from "@/../vendor/never-built/index.ts";

export const reachedOut = [escaped, escapedAgain, neverBuilt];
