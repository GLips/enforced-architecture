// ADVERSARIAL for `types/no-opaque-record`: the bypass that "is it in the
// program" opens.
//
// `AmbientSettlementBag` is declared in `settlement-ambient.d.ts`, which resolves
// fine, is in the program, and is exempt from every walk in this catalog. A check
// that stays quiet on a reference because its declaration EXISTS reports nowhere
// at all here — and an adopter who notices can move every bag in the repo behind
// one ambient alias. The reference reports instead, at each use, because the use
// is the only line anything will ever look at.
export function readAmbientSettlement(bag: AmbientSettlementBag): number {
  return Object.keys(bag).length;
}
