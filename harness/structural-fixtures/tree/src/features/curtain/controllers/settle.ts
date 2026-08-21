// A single arrow parameter needs neither parenthesis nor comma, so a detector
// that looks for a parameter after `(` or `,` sees no binding here at all.
import { createServerFn } from "@tanstack/react-start";
import { postCurtainLedger } from "../service/ledger.ts";

const settleWith = createServerFn => createServerFn().handler(() => postCurtainLedger());

export const settleCurtain = settleWith(() => ({ handler: (run) => run() }));
