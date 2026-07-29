// The shape the rule's own header names: a domain reaching for an SDK.
// EXPECT: a domain importing a provider SDK
import Stripe from "stripe";

export const client = (key: string) => new Stripe(key);
