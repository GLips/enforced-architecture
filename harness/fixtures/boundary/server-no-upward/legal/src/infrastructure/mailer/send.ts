// Infrastructure reaching sideways and downward, which is its whole direction.
import { logger } from "@/infrastructure/telemetry/logger";
import { formatDate } from "@/shared/date";
import { env } from "@/env";
import { renderTemplate } from "./template";

// Top-level directories whose names merely start the same way.
import { featureFlags } from "@/feature-flags";
import { routeTable } from "@/routing";

export const send = () => [logger, formatDate, env, renderTemplate, featureFlags, routeTable];
