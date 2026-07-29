// The configured adapter, which is what callers are meant to use.
import { createStripeClient } from "@/infrastructure/payments/stripe";

// Packages whose names merely start the same way. The `(?:/.*)?` suffix bounds
// each name at a path separator, so a longer package name is a different name.
import { mockCharge } from "stripe-mock";
import { scrub } from "@sentry-internal/scrub";

export const charge = () => [createStripeClient, mockCharge, scrub];
