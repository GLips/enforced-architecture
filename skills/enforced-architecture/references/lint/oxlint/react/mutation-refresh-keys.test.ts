import { describeRule } from "../lib/rule-spec.ts";
import { mutationRefreshKeysRule } from "./mutation-refresh-keys.ts";

const HOOK = "/repo/src/features/billing/controllers/use-save-invoice.ts";
const REFRESH_MODULE = "/repo/src/shared/refresh-after-write.ts";
const OUTSIDE_TREES = "/repo/scripts/seed.ts";

const IMPORTS = `import { useMutation, useQueryClient } from "@tanstack/react-query";
import { INVOICE_WRITE_QUERY_KEYS, invoiceWriteQueryKeys, INVOICES_QUERY_KEY } from "@/shared/query-keys";
import { refreshQueriesAfterWrite } from "@/shared/refresh-after-write";
`;

describeRule("react/mutation-refresh-keys", mutationRefreshKeysRule, {
  obvious: [
    {
      name: "a mutation that writes and refreshes nothing",
      filename: HOOK,
      code: `${IMPORTS}
export const useSaveInvoice = () => useMutation({ mutationFn: submitInvoice });`,
      errors: [{ messageId: "missingRefresh" }],
    },
    {
      name: "a refresh handed a key list built at the call site",
      filename: HOOK,
      code: `${IMPORTS}
export function useSaveInvoice() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: submitInvoice,
    onSuccess: () => refreshQueriesAfterWrite(client, [INVOICES_QUERY_KEY]),
  });
}`,
      errors: [{ messageId: "inlineKeys" }],
    },
    {
      name: "a query client invalidated directly",
      filename: HOOK,
      code: `${IMPORTS}
export const refresh = (client) => client.invalidateQueries({ queryKey: INVOICES_QUERY_KEY });`,
      errors: [{ messageId: "directInvalidation" }],
    },
  ],

  adversarial: [
    {
      name: "a refresh wrapped in a local helper, which is a second place the keys live",
      filename: HOOK,
      code: `${IMPORTS}
const refreshInvoices = (client) => refreshQueriesAfterWrite(client, INVOICE_WRITE_QUERY_KEYS);
export function useSaveInvoice() {
  const client = useQueryClient();
  return useMutation({ mutationFn: submitInvoice, onSuccess: () => refreshInvoices(client) });
}`,
      errors: [{ messageId: "missingRefresh" }],
    },
    {
      name: "a bundle spread into a list with one more key beside it",
      filename: HOOK,
      code: `${IMPORTS}
export function useSaveInvoice() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: submitInvoice,
    onSuccess: () => refreshQueriesAfterWrite(client, [...INVOICE_WRITE_QUERY_KEYS, ["ledger"]]),
  });
}`,
      errors: [{ messageId: "inlineKeys" }],
    },
    {
      name: "a local constant shadowing the bundle's name",
      filename: HOOK,
      code: `import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshQueriesAfterWrite } from "@/shared/refresh-after-write";
const INVOICE_WRITE_QUERY_KEYS = [["invoices"]];
export function useSaveInvoice() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: submitInvoice,
    onSuccess: () => refreshQueriesAfterWrite(client, INVOICE_WRITE_QUERY_KEYS),
  });
}`,
      errors: [{ messageId: "inlineKeys" }],
    },
    {
      name: "a conditional where only one branch is a bundle",
      filename: HOOK,
      code: `${IMPORTS}
export function useSaveInvoice(id) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: submitInvoice,
    onSuccess: () =>
      refreshQueriesAfterWrite(client, id ? invoiceWriteQueryKeys(id) : [INVOICES_QUERY_KEY]),
  });
}`,
      errors: [{ messageId: "inlineKeys" }],
    },
    {
      name: "a read-only entry with no reason, which exempts nothing",
      filename: HOOK,
      options: [{ readOnlyMutations: { submitInvoice: "" } }],
      code: `${IMPORTS}
export const useSaveInvoice = () => useMutation({ mutationFn: submitInvoice });`,
      errors: [{ messageId: "missingRefresh" }],
    },
    {
      name: "options passed as a variable, which cannot be read here",
      filename: HOOK,
      code: `${IMPORTS}
export const useSaveInvoice = (options) => useMutation(options);`,
      errors: [{ messageId: "unreadableOptions" }],
    },
    {
      name: "refetchQueries called by its quoted name",
      filename: HOOK,
      code: `${IMPORTS}
export const refresh = (client) => client["refetchQueries"]({ queryKey: INVOICES_QUERY_KEY });`,
      errors: [{ messageId: "directInvalidation" }],
    },
  ],

  legal: [
    {
      name: "a bundle from the keys module, plain, called, and chosen by a conditional",
      filename: HOOK,
      code: `${IMPORTS}
export function useSaveInvoice(id) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (data) => submitInvoice({ data }),
    onSuccess: async () => {
      await refreshQueriesAfterWrite(client, INVOICE_WRITE_QUERY_KEYS);
      await refreshQueriesAfterWrite(client, invoiceWriteQueryKeys(id));
      await refreshQueriesAfterWrite(client, id ? invoiceWriteQueryKeys(id) : INVOICE_WRITE_QUERY_KEYS);
    },
  });
}`,
    },
    {
      name: "a mutation named read-only, with its reason",
      filename: HOOK,
      options: [{ readOnlyMutations: { previewInvoice: "Renders a draft; persists nothing." } }],
      code: `${IMPORTS}
export const usePreviewInvoice = () =>
  useMutation({ mutationFn: (data) => previewInvoice({ data }) });`,
    },
    {
      name: "the refresh helper's own module, where the client calls live",
      filename: REFRESH_MODULE,
      code: `export async function refreshQueriesAfterWrite(client, keys) {
  for (const queryKey of keys) void client.invalidateQueries({ queryKey, refetchType: "all" });
}`,
    },
    {
      name: "a relative import of the keys module from inside shared",
      filename: "/repo/src/shared/use-save-setting.ts",
      code: `import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SETTING_WRITE_QUERY_KEYS } from "./query-keys";
import { refreshQueriesAfterWrite } from "./refresh-after-write";
export function useSaveSetting() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: submitSetting,
    onSuccess: () => refreshQueriesAfterWrite(client, SETTING_WRITE_QUERY_KEYS),
  });
}`,
    },
    {
      name: "a file outside every declared tree",
      filename: OUTSIDE_TREES,
      code: `export const useSaveInvoice = () => useMutation({ mutationFn: submitInvoice });`,
    },
  ],
});
