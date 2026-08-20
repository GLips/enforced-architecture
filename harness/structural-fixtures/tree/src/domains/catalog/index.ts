// LEGAL: the bottom of the acyclic chain. Imports nothing, from anywhere.
//
// The other half of the direction test, and its emptiness IS the assertion: the
// moment this file grows an import back into pricing the chain becomes a real
// cycle, and the legal case it anchors is gone.
export function skuPrice(sku: string): number {
  return sku.length;
}
