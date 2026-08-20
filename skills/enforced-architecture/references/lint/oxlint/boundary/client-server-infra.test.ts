import { describeRule } from "../lib/rule-spec.ts";
import { clientServerInfraRule } from "./client-server-infra.ts";

const PANEL = "/repo/src/features/billing/ui/panel.tsx";
const SHARED_UI = "/repo/src/shared/ui/badge.tsx";
const IMPORT_DB = `import { db } from "@/infrastructure/db";`;

describeRule("boundary/client-server-infra", clientServerInfraRule, {
  obvious: [
    {
      name: "a client component importing the server-only DB wrapper",
      filename: PANEL,
      code: IMPORT_DB,
      errors: [{ message: "Client contexts may only import client-safe infrastructure/ modules. From inside a feature, move it to controllers/ or to repo/ \u2014 or use the client-safe adapter. NOT service/, and NOT renaming the file to *.server: a service layer imports no infrastructure at all, and a .server module at a feature root or as its barrel is a feature-root or feature-barrel file, which boundary/import-policy denies infrastructure to. Each of those silences this rule and lights up that one, and a pair of diagnostics forbidding each other's fix is an edit loop." }],
    },
    {
      name: "a route module is isomorphic, so its loader's imports reach the client too",
      filename: "/repo/src/routes/admin.tsx",
      code: `import { mailer } from "@/infrastructure/mailer";\nexport const loader = () => mailer;`,
      errors: [{ messageId: "serverOnlyInfraInClient" }],
    },
    {
      name: "a shared module is compiled into whatever imports it, client included",
      filename: "/repo/src/shared/audit.ts",
      code: `import { auditSink } from "@/infrastructure/telemetry/sink";`,
      errors: [{ messageId: "serverOnlyInfraInClient" }],
    },
  ],

  adversarial: [
    {
      name: "a dynamic import puts the module in a client chunk just as surely",
      filename: SHARED_UI,
      code: `export const lazyStripe = async () => (await import("@/infrastructure/stripe/client")).stripe;`,
      errors: [{ messageId: "serverOnlyInfraInClient" }],
    },
    {
      name: "a re-export carries the same dependency an import does",
      filename: SHARED_UI,
      code: `export { auditSink } from "@/infrastructure/telemetry/sink";`,
      errors: [{ messageId: "serverOnlyInfraInClient" }],
    },
    {
      name: "a star re-export names no binding to notice",
      filename: SHARED_UI,
      code: `export * from "@/infrastructure/telemetry/sink";`,
      errors: [{ messageId: "serverOnlyInfraInClient" }],
    },
    {
      name: "a type-only import still points the client layer at a server module",
      filename: PANEL,
      code: `import type { Mailer } from "@/infrastructure/mailer";`,
      errors: [{ messageId: "serverOnlyInfraInClient" }],
    },
    {
      name: "the allowlist is exact, so a neighbour of a client-safe module is not client-safe",
      filename: PANEL,
      code: `import { session } from "@/infrastructure/auth/client-legacy";`,
      errors: [{ messageId: "serverOnlyInfraInClient" }],
    },
    {
      name: "the bare infrastructure barrel has no path segment after it to match on",
      filename: PANEL,
      code: `import infra from "@/infrastructure";`,
      errors: [{ messageId: "serverOnlyInfraInClient" }],
    },
    {
      name: "a directory that merely ends in 'service' is not the service layer",
      filename: "/repo/src/features/billing/legacy-service/charge.ts",
      code: IMPORT_DB,
      errors: [{ messageId: "serverOnlyInfraInClient" }],
    },
  ],

  legal: [
    {
      name: "the controllers layer is a server context",
      filename: "/repo/src/features/billing/controllers/charge.ts",
      code: IMPORT_DB,
    },
    {
      name: "the repo layer is a server context",
      filename: "/repo/src/features/billing/repo/queries.ts",
      code: IMPORT_DB,
    },
    {
      name: "the service layer is a server context",
      filename: "/repo/src/features/billing/service/charge.ts",
      code: `import { mailer } from "@/infrastructure/mailer";`,
    },
    {
      name: "a .server.ts file is a server context whatever directory it sits in",
      filename: "/repo/src/features/billing/ui/loader.server.ts",
      code: IMPORT_DB,
    },
    {
      name: "the two modules the allowlist names, which is the whole allowlist",
      filename: PANEL,
      code: `import { authClient } from "@/infrastructure/auth/client";\nimport { queryClient } from "@/infrastructure/providers/query-client";`,
    },
    {
      name: "a test may reach across every boundary",
      filename: "/repo/src/features/billing/ui/panel.test.tsx",
      code: IMPORT_DB,
    },
    {
      name: "a top-level directory that merely starts with the infrastructure segment",
      filename: PANEL,
      code: `import { mailer } from "@/infrastructure-legacy/mailer";`,
    },
    {
      name: "build config outside src/ is a different question from what a running client bundles",
      filename: "/repo/vite.config.ts",
      code: IMPORT_DB,
    },
  ],
});
