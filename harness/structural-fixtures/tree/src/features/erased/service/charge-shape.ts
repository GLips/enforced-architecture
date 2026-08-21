// Server-only package, imported for a type and nothing else. The parser reports
// this edge marked `typeOnly`; `runtimeSpecifiers` is what drops it. Stop
// dropping it and this feature's barrel reports a violation that does not exist.
import type Stripe from "stripe";

export const shapeOfCharge = (charge: Stripe): string => String(charge);
