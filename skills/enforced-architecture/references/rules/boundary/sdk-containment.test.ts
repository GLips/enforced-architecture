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
      errors: [{ messageId: "rawSdkOutsideInfrastructure" }],
    },
    {
      name: "a UI component reporting to the telemetry SDK directly",
      filename: UI,
      code: `import { captureException } from "@sentry/react";`,
      errors: [{ messageId: "rawSdkOutsideInfrastructure" }],
    },
  ],

  adversarial: [
    {
      name: "a package subpath is the same package, spelled past the name",
      filename: UI,
      code: `import { StripeElements } from "stripe/lib/elements";`,
      errors: [{ messageId: "rawSdkOutsideInfrastructure" }],
    },
    {
      name: "a scoped package's own subpath, two separators deep",
      filename: UI,
      code: `import { sendLoop } from "@loops-so/node/transactional";`,
      errors: [{ messageId: "rawSdkOutsideInfrastructure" }],
    },
    {
      name: "a dynamic import is a call expression, not an import declaration",
      filename: UI,
      code: `export const session = async () => (await import("better-auth/react")).useSession;`,
      errors: [{ messageId: "rawSdkOutsideInfrastructure" }],
    },
    {
      name: "a re-export hands the raw SDK on under the feature's own name",
      filename: SERVICE,
      code: `export { posthog } from "posthog-node";`,
      errors: [{ messageId: "rawSdkOutsideInfrastructure" }],
    },
    {
      name: "a star re-export names no binding to notice",
      filename: SERVICE,
      code: `export * from "@sentry/node";`,
      errors: [{ messageId: "rawSdkOutsideInfrastructure" }],
    },
    {
      name: "a directory that merely starts with 'infrastructure' is not the wrapper layer",
      filename: "/repo/src/infrastructure-legacy/payments/stripe.ts",
      code: IMPORT_STRIPE,
      errors: [{ messageId: "rawSdkOutsideInfrastructure" }],
    },
    {
      name: "a file whose name merely starts like an approved entrypoint is not one",
      filename: "/repo/src/routes/__root-layout.tsx",
      code: `import { captureException } from "@sentry/react";`,
      errors: [{ messageId: "rawSdkOutsideInfrastructure" }],
    },
  ],

  legal: [
    {
      name: "the wrapper layer is exactly where the raw SDK belongs",
      filename: "/repo/src/infrastructure/payments/stripe.ts",
      code: `${IMPORT_STRIPE}\nimport { captureException } from "@sentry/node";`,
    },
    {
      name: "the root route, a named entrypoint where SDK setup has nowhere else to go",
      filename: "/repo/src/routes/__root.tsx",
      code: `import { captureException } from "@sentry/react";`,
    },
    {
      name: "the router entrypoint, likewise",
      filename: "/repo/src/router.tsx",
      code: `import { posthog } from "posthog-node";`,
    },
    {
      name: "the configured adapter, which is what callers are meant to import",
      filename: SERVICE,
      code: `import { createStripeClient } from "@/infrastructure/payments/stripe";`,
    },
    {
      name: "a package whose name merely starts with a restricted one",
      filename: SERVICE,
      code: `import { mockCharge } from "stripe-mock";`,
    },
    {
      name: "a scope whose name merely starts with a restricted one",
      filename: SERVICE,
      code: `import { scrub } from "@sentry-internal/scrub";`,
    },
    {
      name: "an unrestricted library, which has no credential and no IO to centralise",
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
