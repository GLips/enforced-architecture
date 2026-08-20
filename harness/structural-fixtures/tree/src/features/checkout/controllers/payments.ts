// The middle hop of the checkout chain. Clean in isolation, which is the point.
import { openSession } from "../service/session.ts";

export type CheckoutSession = { id: string };

export function chargeCard(cardId: string): CheckoutSession {
  return { id: openSession(cardId) };
}
