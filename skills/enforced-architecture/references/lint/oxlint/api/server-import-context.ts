// ─── api/server-import-context ───────────────────────────────────────
//
// Makes sure: A `*/index.server` specifier appears only in a server context: a
// feature's `controllers/`, `service/` or `repo/` directory, anything under
// `infrastructure/`, and any file named `*.server.ts`. You change an export of
// an `index.server.ts`, and every caller outside a test sits in one of those
// places. To find them you read those directories, not the whole `ui/` and
// `routes/` trees.
//
// Do not add the routes profile to `runsOnServer`. A loader runs on the server
// for the first request, thus the directory looks like a server context. The
// same load path runs in the browser on a client-side navigation
// (`@tanstack/router-core/src/load-matches.ts` calls `route.options.loader`),
// so a route file is isomorphic. A route that needs the server barrel takes
// the name `*.server.ts`, as `routes/api.invoices.server.ts` does.
//
// The fastest way to clear this finding is to rename the file to `*.server.ts`.
// The name is a claim, and this rule takes the claim as given. Nothing here
// tests that the file runs only on the server, so a renamed UI module is
// exempt and reports nothing.
//
// Do not exempt type-only imports with `isTypeOnlyDeclaration`. A type is
// erased at build time, thus the exemption looks free. A client file that
// names a type from a server barrel still depends on that barrel's shape,
// which is the coupling every boundary rule in this catalog counts.
// ─────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { classifyFileRole, isServerContext } from "../../policy/declared-trees.ts";
import { withoutSourceExtension } from "../../policy/layout.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

export const serverImportContextRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      serverBarrelInClientContext:
        "*/index.server is a server-only barrel and this is a client context. Routes are isomorphic; use the client-safe barrel there. This rule answers the CONTEXT question only — which server context may reach a given barrel is boundary/import-policy's answer, and from inside a feature that is controllers/, service/ and a .server.ts module at the feature ROOT. Not the feature's own index.server.ts, which is a barrel and may name nothing outside its feature; not repo/, which is a leaf; not infrastructure/, which sits below features.",
    },
  },
  create(context) {
    const role = classifyFileRole(context.filename);
    if (role === undefined) return {};
    if (isServerContext(role)) return {};

    const { serverBarrelModule } = role.tree.vocabulary;

    return visitModuleSources((source, specifier) => {
      // Requires a preceding `/`, matching the relative
      // (`../billing/index.server`) and aliased spellings alike, and ends at the
      // segment boundary so a neighbour named `index.server-config` is a
      // different module.
      if (withoutSourceExtension(specifier).endsWith(`/${serverBarrelModule}`)) {
        context.report({ node: source, messageId: "serverBarrelInClientContext" });
      }
    });
  },
});
