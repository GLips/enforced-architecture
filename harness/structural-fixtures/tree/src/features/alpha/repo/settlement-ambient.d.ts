// An AMBIENT declaration, which every rule in the catalog exempts as a structural
// fact — and which is therefore the cheapest place to hide a bag. Nothing walks
// this file, so `opaque-record-ambient.ts` is where the bag has to report.
declare type AmbientSettlementBag = Record<string, unknown>;
