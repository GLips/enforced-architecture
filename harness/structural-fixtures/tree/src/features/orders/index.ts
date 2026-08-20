// LEGAL: the server-only dependency sits BELOW a real server-function boundary.
// Silent.
//
// index.ts → controllers/place.ts → service/inventory.ts → "postgres". The chain
// is the same shape as checkout's and the leaf is just as server-only, but the
// framework compiler replaces the `.handler()` body in place.ts with an RPC stub,
// so nothing under it reaches the client bundle. The trace has to stop there.
//
// If the short-circuit breaks, this barrel reports — and a check that fires on
// the ordinary way a feature exposes a mutation is one that gets switched off
// rather than fixed.
export { placeOrder } from "./controllers/place.ts";
