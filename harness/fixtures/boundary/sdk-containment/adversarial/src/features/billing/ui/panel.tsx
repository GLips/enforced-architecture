// EXPECT: a package subpath, where the pattern matched the bare package name
import { StripeElements } from "stripe/lib/elements";

// EXPECT: a scoped package, single-quoted
import { captureException } from '@sentry/react';

// EXPECT+2: a dynamic import, invisible to JsModuleSource
export const lazyAuth = async () =>
  (await import("better-auth/react")).useSession;

// EXPECT: a re-export carries the same dependency an import does
export { posthog } from "posthog-node";

// EXPECT: a scoped package's own subpath
import { sendLoop } from "@loops-so/node/transactional";

export const Panel = () => [StripeElements, captureException, sendLoop];
