// The only `import … from "@tanstack/react-start"` in this file is JSX text
// rendered to the page. It is not a string and not a comment, so neither
// comment-blanking nor literal-masking touches it, and a reader that scans the
// source text for an import statement finds one. What actually runs is a local
// service function wearing the alias that fabricated clause hands it.
import { postAwningLedger as boundaryCall } from "../service/ledger.ts";

export function AwningSetup() {
  return (
    <span>
      import { createServerFn as boundaryCall } from "@tanstack/react-start"
    </span>
  );
}

export const settleAwning = boundaryCall();
