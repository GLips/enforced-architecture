// The only `import … from "@tanstack/react-start"` in this file is inside a
// string, and the thing actually called is a local service function wearing the
// boundary's name. A reader that scans raw source for an import statement finds
// one, pairs it with the call, and cuts a chain that was never cut.
import { postFacadeLedger as createServerFn } from "../service/ledger.ts";

const SETUP_HINT = 'import { createServerFn } from "@tanstack/react-start"';

export function settleFacade(): string {
  return `${SETUP_HINT.length}:${createServerFn()}`;
}
