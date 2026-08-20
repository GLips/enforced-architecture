// The leaf of the checkout chain: the runtime import of a server-only package.
// `stripe` is never installed — nothing in this tree executes.
import Stripe from "stripe";

export function openSession(cardId: string): string {
  const gateway = String(Stripe);
  return `${gateway}:${cardId}`;
}
