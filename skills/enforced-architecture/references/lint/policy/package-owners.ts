// ─── policy/package-owners — which module owns which SDK ─────────────────────
//
// The data behind `boundary/sdk-containment`. It lives here rather than inside
// that rule for the same reason the import table does: it is a fact about the
// application's shape, and a rule body is a place no reader can enumerate.
//
// This is NOT part of the import table, and folding it in is the one merge that
// did not pay. Its policy is keyed by exact package and exact module, not by
// area — and reaching an ordering where the table could express it forces
// `domain → package` to claim the domain may import any package, a cell stating
// something untrue so that machinery could work. One table, several readers; the
// rule merge was the part worth refusing.
//
// A domain importing a raw SDK genuinely breaks two policies and gets two
// diagnostics, which is deliberate. The one requirement is that both stay jointly
// actionable: the ownership message NAMES ITS OWNERS and does not prescribe an
// import, because "import the wrapper from infrastructure instead" is a fix that
// `import-policy`'s runtime purity ALSO forbids, and a pair of diagnostics that
// each forbid the other's fix is an edit loop. Read together, the two resolve to
// "the dependency has to be supplied from above", which is the right answer.
//
// A row names a package by its CANONICAL name and never by pattern. Matching a
// subpath is the reader's job — `stripe/webhooks` is `stripe` — so there is no
// anchor to get wrong, where a regex alternation of package names has one per
// entry and reads `stripe-mock` as `stripe` the first time somebody forgets it.
//
// ── Adapt ────────────────────────────────────────────────────────────────────
//
// One row per CANONICAL package name. Not a regex, and not a group: an entry
// covering three packages against two possible owners makes "the declared owner
// no longer imports this package" a question with no definition, and the rule
// then cannot tell a live containment from a dead one.
//
// A package belongs here when a SECOND import site would have to repeat a
// decision: a credential to supply, a connection to open, a per-environment value
// to pick, or behaviour that differs by platform or runtime. Any one is enough,
// and the criterion is the decision rather than the vendor — a platform or
// stdlib-shaped package counts.
//
// What does NOT belong is a library with no credential, no IO and no
// per-environment config: date maths, schema validation, immutable helpers.
// Wrapping those buys an indirection and nothing else, and a list that grows past
// the packages meeting the criterion teaches people the rule is arbitrary.
//
// NEGATIVE SPACE: a package with no row here is UNCONSTRAINED, and nothing
// detects that state. Whether a package reaches a network, a keychain or a
// filesystem is a judgement; the nearest mechanical proxy would flag React while
// still missing the first bad import. Adding an SDK means adding the row.
//
// NEGATIVE SPACE: an ORM is deliberately absent. `drizzle-orm` is imported by
// every repo module and by the schema, which is the LAYER-RESTRICTED pattern —
// `boundary/db-isolation` fences the DB client and schema by layer, and a wrapper
// around a query builder would only forward calls. Containment and layer
// restriction are different answers, and putting a layer-restricted package on
// this list bans it from the layer it belongs in.
//
// ─────────────────────────────────────────────────────────────────────────────

export type PackageOwnership = {
  /** The package, exactly as package.json spells it. Subpaths are the reader's job. */
  package: string;
  /**
   * The modules allowed to import it, source-root-relative and with the real
   * extension. A LIST because two modules can jointly own one capability, and an
   * explicit list is what makes "does any owner still import this?" answerable.
   */
  owners: string[];
  /** Which decisions the wrapper already made, and what a second caller would get wrong. */
  why: string;
};

/**
 * Example rows in the layout `directory-model.md` recommends. They are worked
 * examples of the criterion above, not a catalog to adopt: keep the rows whose
 * package the project actually has, delete the rest, and add one per SDK as it
 * arrives. A row naming a package that is not a dependency is inert, which makes
 * a stale list quiet rather than wrong — the reason to prune is that the file is
 * read as the statement of what this app contains.
 */
export const PACKAGE_OWNERS: PackageOwnership[] = [
  {
    package: "stripe",
    owners: ["infrastructure/integrations/stripe.ts"],
    why: "The secret key, the API version pin and the idempotency policy are settled once at the adapter. A second construction picks its own API version — which is how one call site starts receiving a payload shape the rest of the app does not expect, on a date nobody chose — and usually omits the idempotency key, which turns a retried request into a second charge.",
  },
  {
    package: "better-auth",
    owners: ["infrastructure/auth/index.ts", "infrastructure/auth/client.ts"],
    why: "Two modules jointly own this because the capability genuinely has two halves: the server config holds the secret and the database adapter, and the browser client holds the base URL and nothing else. That split is the whole point — a third import site is a file that has to decide which half it is, and the file that decides wrong ships a secret to the browser.",
  },
  {
    package: "@sentry/node",
    owners: ["infrastructure/telemetry/sentry.ts"],
    why: "The DSN, the environment name, the release identifier and the sample rate describe the deployment rather than anything a request is doing, and they are read where the deployment is already described. A second initialisation double-reports every event and splits the dashboard across two release strings — which shows up as a graph that looks wrong rather than as an error.",
  },
  {
    package: "@loops-so/loops-js",
    owners: ["infrastructure/integrations/email.ts"],
    why: "Take the capability the adapter exposes — the named transactional sends — rather than the client. The decisions it makes are not incidental: which template id each message uses, and that a send failure is logged rather than thrown, because a signup that succeeded must not fail on its welcome email. A second caller reaching for the SDK makes both choices again.",
  },
  {
    package: "posthog-node",
    owners: ["infrastructure/telemetry/analytics.ts"],
    why: "The project key, the host, and the flush policy for a short-lived server process are decided at the adapter, along with what an event is allowed to carry. A second call site stamps its own property names onto events whose only value is that they join, and the disagreement surfaces as a funnel that silently drops half its steps.",
  },
];
