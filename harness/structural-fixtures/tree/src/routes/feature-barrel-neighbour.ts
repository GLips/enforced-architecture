// LEGAL for api/feature-visibility: a route importing a feature. Silent.
//
// A grant is a FEATURE's answer about another FEATURE. A route has no
// visibility.json, no grants to write and nothing to be granted, so the edge
// route -> leaf-two needs no entry anywhere — and with the importing end's
// guard gone the check reads its feature name off a classification that has
// none, then files "undefined imports leaf-two" against a file whose owner did
// nothing wrong and cannot make the finding go away.
//
// Nothing else in the tree imports a feature from outside one: every other edge
// into a feature starts in another feature, so every one of them passes with the
// importer guard deleted. This is the only file that separates the two.
//
// leaf-two rather than an ungranted feature on purpose: its visibility.json
// exists and holds a real grant, so the over-match lands in a file that IS the
// rule's subject, where it reads as an ordinary denial rather than as a missing
// file.
import { readLeafTwo } from "@/features/leaf-two/index.ts";

export const leafTwoRow = readLeafTwo("route");
