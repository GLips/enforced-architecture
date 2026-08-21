// The name is introduced by a destructuring pattern, so the character before it
// is `{`, not `(` or `,` — the third way past a paren-anchored parameter reader.
import { createServerFn } from "@tanstack/react-start";
import { postDrapeLedger } from "../service/ledger.ts";

function settleWith({ createServerFn }) {
  return createServerFn().handler(() => postDrapeLedger());
}

export const settleDrape = settleWith({ createServerFn: () => ({ handler: (run) => run() }) });
