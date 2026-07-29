// The one module allowed to read env, which is the point of the rule.
export const env = {
  stripeKey: process.env.STRIPE_KEY ?? "",
  publicUrl: import.meta.env.VITE_PUBLIC_URL ?? "",
};
