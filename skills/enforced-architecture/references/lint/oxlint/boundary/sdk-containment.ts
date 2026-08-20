// ─── boundary/sdk-containment ────────────────────────────────────────
//
// Tag:       boundary
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: Direct imports of wrapped third-party SDK packages from
//           anywhere outside infrastructure/. SDKs that require
//           configuration (API keys, client options, retry policies)
//           must be wrapped in an infrastructure adapter. Consumer code
//           imports the adapter, never the raw package. This ensures
//           API keys live in one place, SDK upgrades are absorbed in
//           one place, and provider swaps affect one module.
//
// Applies:  All src/** files EXCEPT:
//           - src/infrastructure/** (IS the wrapper layer)
//           - Approved app entrypoints (router, root route, client)
//           - Instrumentation files
//           - Test files and scripts
//
// Error:    "Direct provider SDK imports are restricted to
//            infrastructure/ modules (except approved app entrypoints).
//            Import the configured adapter from @/infrastructure/...
//            instead."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. Which packages belong on `WRAPPED_SDKS` — the criterion, not a catalog:
//
//    A package belongs here when a SECOND import site would have to
//    repeat a decision. That is the whole test. Ask it of each candidate:
//
//    - Does it authenticate? A key, token, account id or signing secret
//      means the answer to "which credential, from where" gets decided
//      again at every call site that constructs a client.
//    - Does it open a connection? An HTTP client, socket, or pool
//      carries timeout, retry and cancellation policy with it.
//    - Is it configured per environment? Base URL, region, sample rate.
//      Two sites will drift, and the drift shows up in one environment.
//    - Does its behaviour differ by platform or runtime? This is the
//      sharp one on anything that might reach the browser: a package
//      whose web implementation is an empty stub needs that difference
//      handled in ONE place, not wherever it got imported. Storage,
//      secure storage, filesystem and network all qualify.
//    - Could you plausibly swap it for a competitor? Then the surface
//      you depend on should be yours, not theirs.
//
//    Any one of those is enough. Platform and stdlib-shaped packages
//    count as SDKs — the criterion is the decision, not the vendor.
//
//    What does NOT belong: a library with no credential, no IO and no
//    per-environment config. Date maths, schema validation, immutable
//    helpers. Wrapping those buys an indirection and nothing else, and a
//    restricted list that grows past the packages meeting the criterion
//    above teaches people the rule is arbitrary.
//
//    Write them as ONE alternation, not one regex per package. Pairing a
//    bare package with its subpath form is then structural rather than a
//    step you can forget — the trailing `(?:\/|$)` covers `stripe/lib/x`
//    and `@sentry/node` with the same expression that covers `stripe`,
//    and it is what stops `stripe-mock` and `@sentry-internal/scrub`
//    from being read as the packages they merely resemble. Forgetting
//    the pairing was the most common way an adaptation of this template
//    came out weaker than the template; this shape removes the chance.
//
// 2. Which layer IS the wrapper — `WRAPPER_LAYER`:
//    Adjust if the wrapper layer has a different name.
//    Examples:
//      /\/src\/infrastructure\//  — standard (this template)
//      /\/src\/infra\//           — abbreviated naming
//      /\/src\/adapters\//        — ports-and-adapters naming
//
// 3. App entrypoints that need raw SDK access — `APP_ENTRYPOINTS`:
//    Some framework entrypoints have nowhere to put SDK setup (Sentry
//    instrumentation, auth provider setup in a root layout). Add those
//    files here. Keep the list minimal and match whole filenames —
//    every entry is a potential bypass vector.
//
// 4. Layer-restricted vs. wrapped:
//    This rule is for WRAPPED SDKs only (banned outside infra).
//    Layer-restricted SDKs (like ORMs allowed in repo/ files)
//    should use db-isolation or a separate layer-restriction rule.
//
// 5. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "sdk-containment": sdkContainmentRule }`) and turn it on in
//    `.oxlintrc.json` (`"<plugin>/sdk-containment": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

const WRAPPED_SDKS =
  /^(?:stripe|better-auth|posthog-node|@sentry\/[^/]+|@loops-so\/[^/]+)(?:\/|$)/;

const WRAPPER_LAYER = /\/src\/infrastructure\//;
const APP_ENTRYPOINTS = [
  /\/src\/router\.[tj]sx?$/,
  /\/src\/routes\/__root\.[tj]sx?$/,
  /\/src\/client\.[tj]sx?$/,
  /\/instrument\.server\.mjs$/,
];

export const sdkContainmentRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      rawSdkOutsideInfrastructure:
        "Direct provider SDK imports are restricted to infrastructure/ modules (except approved app entrypoints). Import the configured adapter from @/infrastructure/... instead. If this is a new SDK, create its adapter in infrastructure/ and add the package to this rule's restricted list.",
    },
  },
  create(context) {
    const { filename } = context;
    if (isArchitectureExemptPath(filename) || WRAPPER_LAYER.test(filename)) return {};
    if (APP_ENTRYPOINTS.some((entrypoint) => entrypoint.test(filename))) return {};

    return visitModuleSources((source, specifier) => {
      if (WRAPPED_SDKS.test(specifier)) {
        context.report({ node: source, messageId: "rawSdkOutsideInfrastructure" });
      }
    });
  },
});
