// Infrastructure reaching sideways and downward, which is its whole direction.
import { logger } from "@/infrastructure/telemetry/logger";
import { formatDate } from "@/shared/date";
import { env } from "@/env";
import { renderTemplate } from "./template";

// Top-level directories whose names merely start the same way. The first two
// are the ones that matter: they share a full prefix with a forbidden segment,
// so an unbounded `@/features.*` reports them and a bounded `@/features(?:/.*)?`
// does not. `@/feature-flags` and `@/routing` diverge before the segment ends
// and would pass either pattern, so they prove nothing on their own — keep the
// prefix-sharing pair or this file stops testing the boundary it exists for.
import { registry } from "@/featuresets/registry";
import { legacyCart } from "@/features-legacy/cart";
import { featureFlags } from "@/feature-flags";
import { routeTable } from "@/routing";

export const send = () => [logger, formatDate, env, renderTemplate, registry, legacyCart, featureFlags, routeTable];
