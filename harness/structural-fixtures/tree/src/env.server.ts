// LEGAL: a source-root file on the whitelist. It must stay silent.
//
// An env module is not a layer and has no layer it could move to, so a
// whitelist of directory names alone rejects it — the first thing this rule
// gets wrong, and the one that gets it switched off, because the file it
// refuses is one the architecture's own directory model recommends.
//
// The neighbouring `client.tsx` and `router.tsx` are here for
// another check and reach the same branch; this one proves the branch reads the
// catalog default rather than only the fixture config's two additions.
export const databaseUrl = process.env.DATABASE_URL ?? "";
