// The same dependency spelled the ways a re-export pattern misses.

// EXPECT: a named re-export rather than a namespace one
export { chargeCard } from "./index.server";

// EXPECT: a plain import, not a re-export at all
import { auditLog } from "./index.server";

// EXPECT+2: a dynamic import is a call expression, not a module source
export const lazyCharge = async () =>
  (await import("./index.server")).chargeCard;

export const audited = auditLog;
