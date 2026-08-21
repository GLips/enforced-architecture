// ADVERSARIAL: the server-function boundary FAKED, one word at a time.
//
// index.ts → controllers/settle.ts → service/ledger.ts → "postgres". The same
// shape as orders/, and the same server-only leaf — but nothing here crosses a
// boundary. `settle.ts` takes the framework module as a side-effect import,
// which binds no name, and defines its own local `createServerFn`.
//
// A check that asks "is the module imported anywhere" and "does the call name
// appear anywhere" as two separate questions accepts this and suppresses the
// finding. So does one that asks either question alone. Only asking whether the
// CALLED BINDING came from the framework import reports it.
export { settleLedger } from "./controllers/settle.ts";
