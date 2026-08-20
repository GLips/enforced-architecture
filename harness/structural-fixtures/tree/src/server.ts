// LEGAL: a source-root entrypoint importing a sibling env module, which is the
// most natural spelling of the most common edge in the source root.
//
// The env modules carry their own AREA — what may reach server env is the
// question two columns of the policy table exist to answer — but they sit in the
// source root and therefore in the source root's UNIT. Split those apart and
// this edge comes back as a permitted crossing spelled relatively, telling the
// author to write `@/env.server`: the same edge, one directory further from
// where it is.
import { databaseUrl } from "./env.server.ts";

export const startupBanner = `db=${databaseUrl}`;
