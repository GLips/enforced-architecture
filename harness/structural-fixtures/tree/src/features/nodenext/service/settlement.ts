// The hop reached only by substituting the source extension for the emitted
// one. Server-only by way of `stripe`.
//
// The template import carries a BUILD-PLUGIN QUERY. `oxc-resolver` appends the
// query back onto the path it returns, so an unstripped `?raw` made the
// resolver report a file that is not on disk and the first read of it took this
// whole check down with ENOENT — loud, but loud everywhere, on one import
// anywhere in the tree.
import Stripe from "stripe";
import template from "./settlement-template.ts?raw";

export const settle = (cents: number): number => {
  void Stripe;
  void template;
  return cents;
};
