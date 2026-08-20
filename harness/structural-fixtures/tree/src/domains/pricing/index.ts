// LEGAL: an acyclic chain, pricing -> catalog. It must stay silent.
//
// One domain depending on another is the normal shape of a domain graph — the
// rule is against cycles, not against edges, and a check that reports this is
// one that forbids layering domains at all.
//
// Direction is what separates it from a violation. A check that collects the
// edge set and asks only whether two domains are CONNECTED — an undirected
// reading, which is what a `Set` of unordered pairs or a reachability test that
// forgets which end it started from gives you — reports this and `catalog` as a
// cycle. Nothing in catalog points back.
import { skuPrice } from "@/domains/catalog/index.ts";

export function quoteFor(sku: string): number {
  return skuPrice(sku);
}
