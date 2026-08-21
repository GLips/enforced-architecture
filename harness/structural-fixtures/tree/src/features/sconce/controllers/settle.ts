// `createServerFn` here is this file's name for an unrelated export. Calling it
// crosses no boundary, so the server-only leaf below stays reachable.
import { unrelatedExport as createServerFn } from "@tanstack/react-start";
import { postSconceLedger } from "../service/ledger.ts";

export const settleSconce = createServerFn(() => postSconceLedger());
