// `{ bridge: createServerFn }` binds `createServerFn`, and the character before
// the name is a colon — the one destructuring position a shorthand-only reader
// skips, because a colon AFTER the name (`{ createServerFn: "x" }`) binds
// nothing and must keep being skipped. Both halves of that distinction are
// pinned: this feature and the legal `orders` fixture fail in opposite
// directions if the two are collapsed into one form.
import { createServerFn } from "@tanstack/react-start";
import { postValanceLedger } from "../service/ledger.ts";

function settleWith({ bridge: createServerFn }) {
  return createServerFn().handler(() => postValanceLedger());
}

export const settleValance = settleWith({ bridge: () => ({ handler: (run) => run() }) });
