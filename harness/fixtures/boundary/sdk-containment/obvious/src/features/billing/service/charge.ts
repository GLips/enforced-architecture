// EXPECT+1: a feature importing a wrapped SDK directly
import Stripe from "stripe";

export const charge = (key: string) => new Stripe(key);
