// LEGAL: the server barrel re-exporting the client barrel, which is the edge the
// layer-direction barrel arm has to NOT catch.
//
// Both ends are barrels of one feature, so a naive "does this reach the feature's
// own barrel" test fires here — and this is explicitly permitted: index.server.ts
// presents a superset of the client-safe API, and the direction it must never run
// is the other one (index.ts importing index.server.ts, which is
// `api/barrel-direction`'s finding). The arm therefore excludes a barrel SOURCE
// rather than gating on the source having a layer.
export { placeOrder } from "./index.ts";
