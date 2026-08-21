// FIRES import-policy: a denial about DIRECTION, which no reading of the
// specifier's spelling can make.
//
// `src/shared` sits at the bottom of the graph and may import nothing back —
// everything imports shared, so an edge out of here is reachable from every file
// in the app. Written relatively, the specifier names no `infrastructure/`
// segment for the aliased rules to see. A check whose only verdict is "you
// spelled a crossing relatively" invites the fix of writing
// `@/infrastructure/db/client` instead, and that fix is the same violation with
// a longer name.
//
// One table, two adapters: the relative spelling gets the same DIRECTION denial
// the aliased one gets from the linter.
import { db } from "../../infrastructure/db/client.ts";

export const fingerprint = String(db);
