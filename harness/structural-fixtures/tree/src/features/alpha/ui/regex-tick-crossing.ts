// FIRES cross-boundary-alias: a crossing between a backtick in a regex literal and
// the next real template. Goes quiet the same way quoted-backtick-crossing.ts
// does, from a syntax class a string-only fix leaves standing.
const TICK = /`/;

import { betaThing } from "../../beta/service/beta-thing.ts";

export const RENDERED = `beta: ${betaThing}`;
export const matched = TICK;
