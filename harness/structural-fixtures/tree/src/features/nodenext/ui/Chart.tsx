// The `.tsx` half of the `.js` pair. A component module emits `.js` under the
// default `jsx` setting, so this is reachable only if `.js` admits `.tsx` and
// not `.ts` alone. Server-only by way of `stripe`.
import Stripe from "stripe";

export const Chart = (): string => {
  void Stripe;
  return "chart";
};
