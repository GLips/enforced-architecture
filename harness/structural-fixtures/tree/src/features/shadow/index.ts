// ADVERSARIAL: the boundary imported for real, and a DIFFERENT binding called.
//
// index.ts → controllers/settle.ts → service/ledger.ts → "postgres". The import
// clause names the framework's createServerFn, so a check that reads the clause
// and then accepts any same-named call anywhere in the file treats this as a
// boundary and stops — suppressing the reachable leaf. The call that runs is a
// parameter shadowing the import.
export { settleShadow } from "./controllers/settle.ts";
