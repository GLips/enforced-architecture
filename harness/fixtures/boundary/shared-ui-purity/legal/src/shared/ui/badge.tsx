// Shared UI may reach into shared/ — that is the one @/ path it is allowed,
// and the reason this rule is more permissive than shared-purity.
import { formatDate } from "@/shared/date";
import { tokens } from "@/shared/ui/tokens";
import { cn } from "./cn";

// Top-level directories whose names merely start the same way.
import { featureFlags } from "@/feature-flags";
import { routeTable } from "@/routing";

export const Badge = () => [formatDate, tokens, cn, featureFlags, routeTable];
