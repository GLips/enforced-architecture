/**
 * One owner for "does this specifier name a unit's server barrel", read by both `api/` rules.
 *
 * They held a copy each and the copies had already drifted: `api/barrel-direction` accepted a bare
 * `index.server`, `api/server-import-context` required a preceding `/`, and nothing said which
 * answer was intended. The bare form wins. Under a `baseUrl`-style resolution it IS the source
 * root's own server barrel, and a published package named `index.server` is not a thing; letting
 * one rule see a spelling the other cannot is how the pair stopped agreeing in the first place.
 *
 * NEGATIVE SPACE: the specifier is matched as TEXT, so a folded path
 * (`../billing/../audit/index.server`) reaches this unfolded and the last segment decides. Folding
 * is `policy/layout.ts`'s `classifySpecifier`, and moving these two rules onto it is ea-58's
 * subject across all seven raw matchers — this module is the one place that change now lands for
 * `api/`, rather than two.
 */
import { withoutSourceExtension } from "../../policy/layout.ts";

/**
 * The last segment must BE the server barrel, so a neighbour named `index.server-config` is a
 * different module. Matches it however it is spelled: `./index.server`,
 * `@/features/billing/index.server`, `../billing/index.server`, bare, with or without an extension.
 */
export function namesServerBarrel(specifier: string, serverBarrelModule: string): boolean {
  const bare = withoutSourceExtension(specifier);
  return bare === serverBarrelModule || bare.endsWith(`/${serverBarrelModule}`);
}
