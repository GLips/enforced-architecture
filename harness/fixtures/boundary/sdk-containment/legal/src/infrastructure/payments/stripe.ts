// The wrapper layer is exactly where the raw SDK belongs.
import Stripe from "stripe";
import { captureException } from "@sentry/node";

export const createStripeClient = (key: string) => new Stripe(key);
export const reportPaymentFailure = captureException;
