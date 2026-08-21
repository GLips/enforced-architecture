// The module name and the call name are both present, and neither is the
// framework's: a side-effect import binds nothing, and this `createServerFn` is
// a local function three lines down.
import "@tanstack/react-start";
import { postLedger } from "../service/ledger.ts";

function createServerFn(): { handler: (run: () => string) => string } {
  return { handler: (run) => run() };
}

export const settleLedger = createServerFn().handler(() => postLedger());
