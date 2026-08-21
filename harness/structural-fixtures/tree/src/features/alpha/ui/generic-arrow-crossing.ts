// FIRES import-policy: a crossing in a .ts file that also holds a generic arrow.
// Read under a JSX grammar the arrow is an unclosed tag and the parse fails,
// taking this file's edges with it — so which grammar an extension gets is not a
// detail. `module-scanning.ts` derives it from the same two extension lists the
// walkers use, and this is the file that goes quiet if that derivation is wrong
// in the `.ts` direction.
import { betaThing } from "../../beta/service/beta-thing.ts";

export const firstOf = <T>(rows: T[]) => rows[0];

export const beta = betaThing;
