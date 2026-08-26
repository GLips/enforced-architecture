// The rows this exercises are the example rows in `lint/policy/package-owners.ts`.
// A project that prunes them prunes these cases with them — which is the point of
// the spec shipping beside the rule rather than beside the data: what is proved
// here is the READER, and the reader is the same whatever the rows say.

import { describeRule } from "../lib/rule-spec.ts";
import { sdkContainmentRule } from "./sdk-containment.ts";

const SERVICE = "/repo/src/features/billing/service/charge.ts";
const UI = "/repo/src/features/billing/ui/panel.tsx";
const IMPORT_STRIPE = `import Stripe from "stripe";`;

describeRule("boundary/sdk-containment", sdkContainmentRule, {
  obvious: [
    {
      name: "a feature service constructing the payment SDK itself",
      filename: SERVICE,
      code: IMPORT_STRIPE,
      errors: [{ messageId: "rawSdkOutsideOwner" }],
    },
    {
      name: "a UI component reporting to the telemetry SDK directly",
      filename: UI,
      code: `import { captureException } from "@sentry/node";`,
      errors: [{ messageId: "rawSdkOutsideOwner" }],
    },
  ],

  adversarial: [
    {
      name: "a package subpath is the same package, spelled past the name",
      filename: UI,
      code: `import { StripeElements } from "stripe/lib/elements";`,
      errors: [{ messageId: "rawSdkOutsideOwner" }],
    },
    {
      name: "a scoped package's own subpath, two separators deep",
      filename: UI,
      code: `import { sendLoop } from "@loops-so/loops-js/transactional";`,
      errors: [{ messageId: "rawSdkOutsideOwner" }],
    },
    {
      name: "a dynamic import is a call expression, not an import declaration",
      filename: UI,
      code: `export const session = async () => (await import("better-auth/react")).useSession;`,
      errors: [{ messageId: "rawSdkOutsideOwner" }],
    },
    {
      name: "a re-export hands the raw SDK on under the feature's own name",
      filename: SERVICE,
      code: `export { PostHog } from "posthog-node";`,
      errors: [{ messageId: "rawSdkOutsideOwner" }],
    },
    {
      name: "a star re-export names no binding to notice",
      filename: SERVICE,
      code: `export * from "@sentry/node";`,
      errors: [{ messageId: "rawSdkOutsideOwner" }],
    },
    {
      name: "a literal require() is the same dependency, and reaches no import visitor",
      filename: SERVICE,
      code: `const Stripe = require("stripe");`,
      errors: [{ messageId: "rawSdkOutsideOwner" }],
    },
    {
      name: "a directory that merely starts with 'infrastructure' owns nothing",
      filename: "/repo/src/infrastructure-legacy/integrations/stripe.ts",
      code: IMPORT_STRIPE,
      errors: [{ messageId: "rawSdkOutsideOwner" }],
    },
    {
      name: "a filename that merely extends an owner's does not inherit its exemption",
      filename: "/repo/src/infrastructure/integrations/stripe-legacy.ts",
      code: IMPORT_STRIPE,
      errors: [{ messageId: "rawSdkOutsideOwner" }],
    },
    {
      name: "an owner is exempt for its OWN package only, so the wrapper layer is not one permission",
      filename: "/repo/src/infrastructure/integrations/stripe.ts",
      code: `import { PostHog } from "posthog-node";`,
      errors: [{ messageId: "rawSdkOutsideOwner" }],
    },
    {
      name: "an app entrypoint is not a category that inherits a pass — it owns the row or it does not",
      filename: "/repo/src/router.tsx",
      code: IMPORT_STRIPE,
      errors: [{ messageId: "rawSdkOutsideOwner" }],
    },
    {
      // A row with no owners contains the package EVERYWHERE, and it is the one
      // shape whose message has no owner to name. Asserted in full, because the
      // owned template renders "may only be imported by ." here — a dangling
      // sentence that also sends the reader off to find an owner, when the row
      // exists to say that none is coming.
      name: "a row with no owners bans the package outright, and the message says so",
      filename: "/repo/src/infrastructure/telemetry/sentry.ts",
      code: `import * as Sentry from "@sentry/browser";`,
      errors: [
        {
          message:
            "@sentry/browser may not be imported. Its row on the owner table names no owner, which is a total ban rather than an unfinished row — adding yourself to it is a policy change, not the fix for this diagnostic. Telemetry leaves this app through the one adapter that owns @sentry/node, and no module initialises a second SDK beside it. The browser build carries its own DSN into the client bundle and reports the same error again under a different release string, so the dashboard disagrees with itself and neither number is the true one. There is no file that should hold this import, which is why the row names none.",
        },
      ],
    },
    {
      // The owner of the SIBLING row is the sharpest file to prove it from: a
      // total ban is not weakened by owning something adjacent.
      name: "owning the neighbouring package is not an exemption from a total ban",
      filename: "/repo/src/infrastructure/telemetry/sentry.ts",
      code: `export { withScope } from "@sentry/browser";`,
      errors: [{ messageId: "packageBannedOutright" }],
    },
  ],

  legal: [
    {
      name: "the owning module is exactly where the raw SDK belongs",
      filename: "/repo/src/infrastructure/integrations/stripe.ts",
      code: IMPORT_STRIPE,
    },
    {
      name: "a capability with two owners, each importing it from its own half",
      filename: "/repo/src/infrastructure/auth/client.ts",
      code: `import { createAuthClient } from "better-auth/react";`,
    },
    {
      name: "the configured adapter, which is what callers are meant to import",
      filename: SERVICE,
      code: `import { createStripeClient } from "@/infrastructure/integrations/stripe";`,
    },
    {
      name: "a package whose name merely starts with an owned one",
      filename: SERVICE,
      code: `import { mockCharge } from "stripe-mock";`,
    },
    {
      name: "a scope whose name merely starts with an owned one",
      filename: SERVICE,
      code: `import { scrub } from "@sentry-internal/scrub";`,
    },
    {
      name: "a relative path that happens to end in an owned package's name is a file in this repo",
      filename: SERVICE,
      code: `import { rate } from "./stripe";`,
    },
    {
      name: "an unowned library, which has no credential and no IO to centralise",
      filename: SERVICE,
      code: `import { addDays } from "date-fns";`,
    },
    {
      name: "a test may reach the raw SDK to build a fixture",
      filename: "/repo/src/features/billing/service/charge.test.ts",
      code: IMPORT_STRIPE,
    },
    {
      name: "a one-off script is not part of the shipped module graph",
      filename: "/repo/scripts/backfill-charges.ts",
      code: IMPORT_STRIPE,
    },
  ],
});
