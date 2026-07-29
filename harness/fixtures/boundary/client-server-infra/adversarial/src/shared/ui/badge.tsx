// EXPECT: single quotes, where a regex anchored on \" alone would miss
import { mailer } from '@/infrastructure/mailer';

// EXPECT+2: a dynamic import, invisible to JsModuleSource
export const lazyStripe = async () =>
  (await import("@/infrastructure/stripe/client")).stripe;

// EXPECT: a re-export carries the same dependency an import does
export { auditSink } from "@/infrastructure/telemetry/sink";

// EXPECT: a near-miss on the allowlist — the allowed path is auth/client exactly
import { session } from "@/infrastructure/auth/client-legacy";

export const Badge = () => [mailer, session];

// EXPECT+1: the infrastructure barrel itself, with no path segment after it
import infra from "@/infrastructure";
export const viaBarrel = infra;
