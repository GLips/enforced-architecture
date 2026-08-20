// FIRES layer-direction: a layer importing its OWN feature's barrel.
//
// The barrel has no layer, so the rank comparison below it skips this edge
// entirely — which is exactly why it needs its own arm. It is also the sharpest
// upward edge a feature can contain: index.ts re-exports the layers, so ui
// importing it depends on every layer at once, and the cycle runs through the
// file whose job is to describe the feature from OUTSIDE.
export { placeOrder } from "../index.ts";
