// The escaped hop's target. Reachable only if `./service/charge.ts` is read
// as the module it names rather than as the characters it is written with.
import Stripe from "stripe";

export const chargeOnce = (): string => String(Stripe);
