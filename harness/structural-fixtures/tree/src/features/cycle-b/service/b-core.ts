// The other half of the direct cycle. Granted, aliased, and individually
// unremarkable — nothing about this file read on its own is wrong.
import { chargeAccount } from "@/features/cycle-a/index.ts";

export function settleAccount(id: string): string {
  const charged = chargeAccount.name;
  return `settle:${charged}:${id}`;
}
