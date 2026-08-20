#!/usr/bin/env bun
// FIRES cross-boundary-alias, and the shebang is the point.
//
// A shebang is valid at the top of an executable source file and Bun's reader
// REJECTS it. Nothing catches that, so without the blanking pass in
// `lint/structural/import-graph.ts` this one file aborts the entire graph — every
// graph-reading check reports nothing at all, and the run is green.
//
// Blanked rather than stripped, so every later offset still maps to its real
// line. The crossing below has to be a real violation: written as a legal
// import, the abort is identical and the suite stays quiet about it.
import { betaThing } from "../../beta/service/beta-thing.ts";

export const shebangCrossing = betaThing;
