// FIRES feature-visibility, and fires with the sentence naming the file's SHAPE
// rather than the one naming a missing grant.
//
// `numbered/visibility.json` is the scalar `42`. It parses, it is not null and
// it is not an array, so it reaches the rejection through the ONE disjunct of
// the three that had no witness — `typeof parsed !== "object"`. Delete that
// disjunct and `Object.entries(42)` returns an EMPTY list, so the file becomes a
// grant map that grants nobody and this edge is denied with the ordinary
// ungranted-edge message: same path, same severity, same count, and only the
// sentence moves. The author is sent to add a grant to a file whose shape is the
// problem, which is the divergence class no path assertion can see and the
// reason this case carries a `messages` entry rather than only a FAIL.
//
// `nulled` and `listed` each take a different disjunct and each leaves this one
// intact — a scalar is the only reachable input that reaches it.
import { reading } from "@/features/numbered/index.ts";

export const tally = reading;
