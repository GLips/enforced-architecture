// The import is genuine and unused; the call resolves to the const beside it.
import { createServerFn } from "@tanstack/react-start";
import { postPelmetLedger } from "../service/ledger.ts";

export function settlePelmet(): string {
  const createServerFn = () => ({ handler: (run: () => string) => run() });
  return createServerFn().handler(() => postPelmetLedger());
}
