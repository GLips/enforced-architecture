// The traced module. `stripe` appears here as a type and nowhere else, so the
// compiled output imports nothing at all.
import type Stripe from "stripe";

export function renderInvoice(client: Stripe): string {
  const label = String(client);
  return `invoice:${label}`;
}
