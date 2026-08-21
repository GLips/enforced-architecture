// The import is genuine and unused; the call is a parameter of the same name.
import { createServerFn } from "@tanstack/react-start";
import { postShadowLedger } from "../service/ledger.ts";

type Bridge = () => { handler: (run: () => string) => string };

function settleWith(createServerFn: Bridge): string {
  return createServerFn().handler(() => postShadowLedger());
}

export const settleShadow = settleWith(() => ({ handler: (run) => run() }));
