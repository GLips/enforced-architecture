// LEGAL: the only server-only-looking import in the traced chain is TYPE-ONLY.
// Silent.
//
// The re-export below is a runtime one, so the trace does reach
// service/render.ts and does see `stripe` written there — it just has to see it
// as erased. `import type` emits no runtime code, so it cannot break a client
// bundle, and a check that recovers those edges the way the import graph does
// reports this barrel for coupling that does not exist at runtime.
export { renderInvoice } from "./service/render.ts";
