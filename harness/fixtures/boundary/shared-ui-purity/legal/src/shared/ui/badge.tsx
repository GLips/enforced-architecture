// Shared UI may reach into shared/ — that is the one @/ path it is allowed,
// and the reason this rule is more permissive than shared-purity.
import { formatDate } from "@/shared/date";
import { tokens } from "@/shared/ui/tokens";
import { cn } from "./cn";

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

export const Badge = () => [formatDate, tokens, cn, registry, legacyCart, featureFlags, routeTable];
