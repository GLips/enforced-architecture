// FIRES import-policy: a semantic denial the check this replaces could not make
// at all.
//
// `src/shared` sits at the bottom of the graph and may import nothing back —
// everything imports shared, so an edge out of here is reachable from every file
// in the app. Written relatively, the specifier names no `infrastructure/`
// segment for the aliased rules to see, and the old check's only verdict was
// "you spelled a crossing relatively", which invited the fix of writing
// `@/infrastructure/db/client` instead. That fix is the same violation with a
// longer name.
//
// One table, two adapters: the relative spelling now gets the same DIRECTION
// denial the aliased one gets from the linter.
import { db } from "../../infrastructure/db/client.ts";

export const fingerprint = String(db);
