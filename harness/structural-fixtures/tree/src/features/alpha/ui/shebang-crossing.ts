#!/usr/bin/env bun
// FIRES import-policy, and the shebang is the point.
//
// A shebang is valid at the top of an executable source file, and a reader that
// does not expect one rejects it — taking every edge in this file, and under a
// substrate that read imports with one shared transpiler instance, the entire
// graph. Every graph-reading check then reports nothing at all and the run is
// green.
//
// The crossing below has to be a real violation: written as a legal import, the
// loss is identical and the suite stays quiet about it.
import { betaThing } from "../../beta/service/beta-thing.ts";

export const shebangCrossing = betaThing;
