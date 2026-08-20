// FIRES layer-direction: a file at the FEATURE ROOT reaching its own barrel.
// This file is a root file `placement/topology` permits, it sits in no layer,
// and `index.ts` re-exports it — so this is the identical cycle a layer makes,
// through a file the layer guard would have waved past. The policy engine calls
// this edge `internal` (one unit), correctly, which is exactly why direction
// inside a feature has to be someone else's question.
export { placeOrder } from "./index.ts";
