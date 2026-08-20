// FIRES import-policy: a crossing in a .ts file that also holds a generic
// arrow. The whole graph aborts if one reader serves every extension — under `tsx`
// the arrow reads as unclosed JSX. Caught by the crash guard, not by a missing
// finding, since the abort takes the summary line with it.
import { betaThing } from "../../beta/service/beta-thing.ts";

export const firstOf = <T>(rows: T[]) => rows[0];

export const beta = betaThing;
