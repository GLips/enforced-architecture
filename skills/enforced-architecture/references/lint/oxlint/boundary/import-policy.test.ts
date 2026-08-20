// The cases the four oxlint rules this replaces carried, plus the ones only a
// merged rule can be asked. `shared-purity`, `shared-ui-purity`, `domain-purity`
// and `feature-public-api` each proved their own slice; the interesting failures
// now live where their slices used to meet, so those are here too.
//
// The ENGINE's cases — that a path reaches the cell its author intended, and that
// one edge spelled two ways reaches one verdict — are in
// `lint/policy/import-policy.test.ts`. This file proves the ADAPTER: that the
// rule reads every place a specifier can appear, classifies the file it is
// handed, and reports what the engine returns.
//
// The repo prefix is deliberately not this machine's checkout path. The rule
// finds the source root by its own segment, so any prefix exercises the same
// code — and a spec that hardcodes one developer's home directory is a spec that
// only runs there.

import { describeRule } from "../lib/rule-spec.ts";
import { importPolicyRule } from "./import-policy.ts";

const SRC = "/repo/src";
const SHARED_UI = `${SRC}/shared/ui/Button.tsx`;
const FEATURE_UI = `${SRC}/features/billing/ui/InvoiceTable.tsx`;
const DOMAIN = `${SRC}/domains/pricing/rate-card.ts`;
const ROUTE = `${SRC}/routes/_authed/invoices.tsx`;

describeRule("boundary/import-policy", importPolicyRule, {
  obvious: [
    {
      name: "a primitive taking on a feature dependency",
      filename: SHARED_UI,
      code: `import { useInvoices } from "@/features/billing";`,
      errors: [{ messageId: "deniedDirection" }],
    },
    {
      name: "a shared helper reaching an adapter",
      filename: `${SRC}/shared/utils.ts`,
      code: `import { db } from "@/infrastructure/db/client";`,
      errors: [{ messageId: "deniedDirection" }],
    },
    {
      name: "a domain querying, which makes an answer depend on the database",
      filename: DOMAIN,
      code: `import { invoiceRows } from "@/features/billing/repo/invoice-rows";`,
      errors: [{ messageId: "impureDomainRuntimeImport" }],
    },
    {
      name: "a route reaching past a feature's barrel into its data layers",
      filename: ROUTE,
      code: `import { invoiceSummary } from "@/features/billing/service/invoice-summary";`,
      errors: [{ messageId: "deniedExposure" }],
    },
    {
      name: "a feature reaching into another feature's internals",
      filename: FEATURE_UI,
      code: `import { placeOrder } from "@/features/orders/controllers/place";`,
      errors: [{ messageId: "deniedExposure" }],
    },
    {
      name: "an adapter reaching up into a feature, an edge no rule covered before",
      filename: `${SRC}/infrastructure/telemetry/sentry.ts`,
      code: `import { useInvoices } from "@/features/billing";`,
      errors: [{ messageId: "deniedDirection" }],
    },
    {
      name: "a route reading the server env, which is not isomorphic",
      filename: ROUTE,
      code: `import { serverEnv } from "@/env.server";`,
      errors: [{ messageId: "deniedDirection" }],
    },
    {
      name: "a service reaching infrastructure, an edge no rule covered before",
      filename: `${SRC}/features/billing/service/invoice-summary.ts`,
      code: `import { db } from "@/infrastructure/db/client";`,
      errors: [{ messageId: "deniedDirection" }],
    },
  ],

  adversarial: [
    {
      name: "a dynamic import is a call expression, not an import declaration",
      filename: SHARED_UI,
      code: `export const lazyDb = async () => (await import("@/infrastructure/db/client")).db;`,
      errors: [{ messageId: "deniedDirection" }],
    },
    {
      name: "a re-export carries the same runtime dependency an import does",
      filename: `${SRC}/shared/ui/index.ts`,
      code: `export { InvoiceTable } from "@/features/billing";`,
      errors: [{ messageId: "deniedDirection" }],
    },
    {
      name: "a star re-export names no binding to notice",
      filename: `${SRC}/shared/ui/index.ts`,
      code: `export * from "@/domains/pricing";`,
      errors: [{ messageId: "deniedDirection" }],
    },
    {
      name: "a literal require() is the same dependency the import graph already counted",
      filename: SHARED_UI,
      code: `const db = require("@/infrastructure/db/client");`,
      errors: [{ messageId: "deniedDirection" }],
    },
    {
      name: "require.resolve binds no value and still names the module",
      filename: SHARED_UI,
      code: `export const at = require.resolve("@/features/billing");`,
      errors: [{ messageId: "deniedDirection" }],
    },
    {
      name: "a type-only import still couples the primitive to a domain's shape",
      filename: SHARED_UI,
      code: `import type { RateCard } from "@/domains/pricing";`,
      errors: [{ messageId: "deniedDirection" }],
    },
    {
      name: "a side-effect import binds nothing and still drags the module in",
      filename: SHARED_UI,
      code: `import "@/infrastructure/telemetry/sentry";`,
      errors: [{ messageId: "deniedDirection" }],
    },
    {
      name: "a sibling directory that merely starts with the primitives' segment is a different area",
      filename: `${SRC}/shared/ui-kit/Card.tsx`,
      code: `import { useInvoices } from "@/features/billing";`,
      errors: [{ messageId: "deniedDirection" }],
    },
    {
      name: "a primitive nested in a subdirectory is still a primitive",
      filename: `${SRC}/shared/ui/table/Cell.tsx`,
      code: `import { useInvoices } from "@/features/billing";`,
      errors: [{ messageId: "deniedDirection" }],
    },
    {
      name: "a domain naming a package at runtime, however small the package is",
      filename: DOMAIN,
      code: `import { z } from "zod";`,
      errors: [{ messageId: "impureDomainRuntimeImport" }],
    },
    {
      name: "a domain reaching the client env at runtime, which the caller could have passed",
      filename: `${SRC}/domains/pricing/index.ts`,
      code: `import { clientEnv } from "@/env.client";`,
      errors: [{ messageId: "impureDomainRuntimeImport" }],
    },
    {
      name: "a feature barrel is not a place code lives: everything outside the feature is refused",
      filename: `${SRC}/features/billing/index.ts`,
      code: `import { z } from "zod";\nexport { Button } from "@/shared/ui";`,
      errors: [{ messageId: "deniedDirection" }, { messageId: "deniedDirection" }],
    },
    {
      name: "a feature's errors.ts is at the root and is not the barrel, so its row is its own",
      filename: `${SRC}/features/billing/errors.ts`,
      code: `import { z } from "zod";\nimport { db } from "@/infrastructure/db/client";`,
      errors: [{ messageId: "deniedDirection" }],
    },
    {
      name: "a repo is a leaf: another feature's barrel is still an edge out of it",
      filename: `${SRC}/features/billing/repo/invoice-rows.ts`,
      code: `import { placeOrder } from "@/features/orders";`,
      errors: [{ messageId: "deniedDirection" }],
    },
    {
      name: "a .. segment inside an alias resolves to another area and must not read as this one",
      filename: DOMAIN,
      code: `import { db } from "@/domains/pricing/../../infrastructure/db/client";`,
      errors: [{ messageId: "impureDomainRuntimeImport" }],
    },
    {
      name: "a .. segment cannot launder a cross-feature deep import into a same-unit one",
      filename: FEATURE_UI,
      code: `import { placeOrder } from "@/features/billing/../orders/controllers/place";`,
      errors: [{ messageId: "deniedExposure" }],
    },
    {
      name: "import x = require() binds a value and reaches no ImportDeclaration visitor",
      filename: SHARED_UI,
      code: `import env = require("@/env.server");\nexport const url = env;`,
      errors: [{ messageId: "deniedDirection" }],
    },
    {
      name: "a template literal with no substitutions is the spelling a quote-matcher misses",
      filename: SHARED_UI,
      code: "export const lazy = () => import(`@/infrastructure/db/client`);",
      errors: [{ messageId: "deniedDirection" }],
    },
    {
      name: "an import() in TYPE position names the module without any import statement",
      filename: SHARED_UI,
      code: `export type Invoice = import("@/features/billing").Invoice;`,
      errors: [{ messageId: "deniedDirection" }],
    },
    {
      name: "a new top-level directory enters as an unpoliced area, and says so with no imports at all",
      filename: `${SRC}/lib/format-date.ts`,
      code: `export const formatDate = (value: Date) => value.toISOString();`,
      errors: [{ messageId: "unclassifiedSource" }],
    },
    {
      name: "a directory inside a feature that is not a layer is reached by no policy",
      filename: `${SRC}/features/billing/helpers/format.ts`,
      code: `export const format = (value: string) => value;`,
      errors: [{ messageId: "unclassifiedSource" }],
    },
    {
      name: "an alias naming no area is loud rather than allowed by default",
      filename: FEATURE_UI,
      code: `import { formatDate } from "@/lib/format-date";`,
      errors: [{ messageId: "unclassifiedTarget" }],
    },
  ],

  legal: [
    {
      name: "a primitive reading a shared helper — one boundary, two units, and a decided edge",
      filename: SHARED_UI,
      code: `import { cn } from "@/shared/utils";\nimport { clientEnv } from "@/env.client";`,
    },
    {
      name: "a sibling primitive by alias, and the bare barrel that collects them",
      filename: SHARED_UI,
      code: `import { Text } from "@/shared/ui/Text";\nexport { Box } from "@/shared/ui/Box";\nimport { Icon } from "@/shared/ui";`,
    },
    {
      name: "the packages a primitive is built from, and a scoped one that starts with @",
      filename: SHARED_UI,
      code: `import { useState } from "react";\nimport { cva } from "class-variance-authority";\nimport { useQuery } from "@tanstack/react-query";`,
    },
    {
      name: "a route composing a feature's ui, which is the exception the barrel rule grants",
      filename: ROUTE,
      code: `import { useInvoices } from "@/features/billing";\nimport { InvoiceTable } from "@/features/billing/ui/InvoiceTable";`,
    },
    {
      name: "a controller taking the widest licence in the feature: adapter, server env, both barrels",
      filename: `${SRC}/features/billing/controllers/invoices.ts`,
      code: `import { db } from "@/infrastructure/db/client";\nimport { serverEnv } from "@/env.server";\nimport { rateFor } from "@/domains/pricing";\nimport { placeOrder } from "@/features/orders/index.server";`,
    },
    {
      name: "a feature reaching its own internals by its own alias is inside the feature",
      filename: FEATURE_UI,
      code: `import { useInvoices } from "@/features/billing/controllers/invoices";\nimport { InvoiceError } from "@/features/billing";`,
    },
    {
      name: "a domain barrel deep re-exporting its own modules, which barrel-only would break",
      filename: `${SRC}/domains/pricing/index.ts`,
      code: `export { rateFor } from "@/domains/pricing/rate-card";\nexport type { Money } from "@/domains/pricing/money";`,
    },
    {
      name: "a domain NAMING a package's type, because a type import is erased",
      // The `domain -> package` cell is `any` and the runtime-purity flag denies
      // the runtime edge, so this pair is the whole of what the flag decides.
      // A FEATURE type is a different case and is denied: that cell is `deny`,
      // and a domain that names an invoice's shape is coupled to the feature
      // whether or not the import survives the build.
      filename: DOMAIN,
      code: `import type { z } from "zod";\nimport type { ZodSchema } from "zod/v4";`,
    },
    {
      name: "a domain runtime-importing src/shared and another domain, which is its whole licence",
      filename: DOMAIN,
      code: `import { round } from "@/shared/utils";\nimport { taxFor } from "@/domains/tax";`,
    },
    {
      name: "a repo taking the ORM and the DB client, which is what a repo is for",
      filename: `${SRC}/features/billing/repo/invoice-rows.ts`,
      code: `import { eq } from "drizzle-orm";\nimport { db } from "@/infrastructure/db/client";`,
    },
    {
      name: "the composition root wiring routes and env, and reaching neither a feature nor a domain",
      filename: `${SRC}/router.tsx`,
      code: `import { routeTree } from "@/routeTree.gen";\nimport { clientEnv } from "@/env.client";\nimport { queryClient } from "@/infrastructure/providers/query-client";`,
    },
    {
      name: "a .. that folds back to the file's own unit is still internal",
      filename: `${SRC}/features/billing/ui/InvoiceTable.tsx`,
      code: `import { useInvoices } from "@/features/billing/ui/../controllers/invoices";`,
    },
    {
      name: "an alias climbing out of the source root names no application module",
      filename: FEATURE_UI,
      code: `import { config } from "@/../vite.config";`,
    },
    {
      name: "the bare barrel of a top-level unit, and the same path with a trailing slash",
      filename: FEATURE_UI,
      code: `import { Button } from "@/shared/ui";\nimport { cn } from "@/shared/";`,
    },
    {
      name: "import type X = require() is erased, so the domain flag does not fire",
      filename: DOMAIN,
      code: `import type z = require("zod");\nexport type Schema = z.ZodType;`,
    },
    {
      name: "an asset resolving inside the source tree is not a module edge",
      filename: FEATURE_UI,
      code: `import styles from "@/styles.css?url";\nimport logo from "@/shared/ui/logo.svg";`,
    },
    {
      name: "a relative specifier belongs to the resolving tier, which is the only one that can place it",
      filename: SHARED_UI,
      code: `import { Text } from "./Text";\nimport { cn } from "../utils";`,
    },
    {
      name: "a test may reach across every boundary",
      filename: `${SRC}/shared/ui/Button.test.tsx`,
      code: `import { useInvoices } from "@/features/billing";`,
    },
    {
      name: "a script is not part of the shipped module graph",
      filename: "/repo/scripts/seed.ts",
      code: `import { useInvoices } from "@/features/billing";`,
    },
  ],
});
