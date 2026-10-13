import { describeRule } from "../lib/rule-spec.ts";
import { primedSuspenseReadsRule } from "./primed-suspense-reads.ts";

const COMPONENT = "/repo/src/features/billing/ui/invoice-page.tsx";
const HOOK_MODULE = "/repo/src/features/billing/ui/use-invoice.ts";
const WRAPPER = "/repo/src/shared/primed-query.ts";
const OUTSIDE_TREES = "/repo/scripts/seed.ts";

describeRule("react/primed-suspense-reads", primedSuspenseReadsRule, {
  obvious: [
    {
      name: "a page reading straight from TanStack Query",
      filename: COMPONENT,
      code: `import { useSuspenseQuery } from "@tanstack/react-query";
export const InvoicePage = () => useSuspenseQuery(invoiceQueryOptions).data;`,
      errors: [{ messageId: "unprimedSuspenseHook" }],
    },
    {
      name: "the infinite spelling, in a hook module rather than a component",
      filename: HOOK_MODULE,
      code: `import { useSuspenseInfiniteQuery } from "@tanstack/react-query";
export const useInvoices = () => useSuspenseInfiniteQuery(invoicePagesQueryOptions);`,
      errors: [{ messageId: "unprimedSuspenseHook" }],
    },
  ],

  adversarial: [
    {
      name: "an alias, which keeps the library's name for the hook",
      filename: COMPONENT,
      code: `import { useSuspenseQuery as useRead } from "@tanstack/react-query";
export const InvoicePage = () => useRead(invoiceQueryOptions).data;`,
      errors: [{ messageId: "unprimedSuspenseHook" }],
    },
    {
      name: "a namespace import read as a member",
      filename: COMPONENT,
      code: `import * as Query from "@tanstack/react-query";
export const InvoicePage = () => Query.useSuspenseQueries({ queries: [] });`,
      errors: [{ messageId: "unprimedSuspenseHook" }],
    },
    {
      name: "a re-export that republishes the original under this module's name",
      filename: HOOK_MODULE,
      code: `export { useSuspenseQuery } from "@tanstack/react-query";`,
      errors: [{ messageId: "unprimedSuspenseHook" }],
    },
  ],

  legal: [
    {
      name: "the wrapper itself, the one module that imports the originals",
      filename: WRAPPER,
      code: `import { useSuspenseQuery } from "@tanstack/react-query";
export const usePrimedSuspenseQuery = (options) => useSuspenseQuery(options);`,
    },
    {
      name: "a read through the wrapper",
      filename: COMPONENT,
      code: `import { usePrimedSuspenseQuery } from "@/shared/primed-query";
export const InvoicePage = () => usePrimedSuspenseQuery(invoiceQueryOptions).data;`,
    },
    {
      name: "a non-suspending read, which shows its own loading state",
      filename: COMPONENT,
      code: `import { useQuery } from "@tanstack/react-query";
export const InvoicePage = () => useQuery(invoiceQueryOptions).data;`,
    },
    {
      name: "a type named after a suspense hook is no read",
      filename: HOOK_MODULE,
      code: `import type { UseSuspenseQueryResult } from "@tanstack/react-query";
export type InvoiceRead = UseSuspenseQueryResult<number>;`,
    },
    {
      name: "a script outside every declared tree",
      filename: OUTSIDE_TREES,
      code: `import { useSuspenseQuery } from "@tanstack/react-query";`,
    },
  ],
});
