// ─── boundary/client-server-infra ────────────────────────────────────
//
// Makes sure: A client file imports only the infrastructure modules on
// `CLIENT_SAFE_INFRASTRUCTURE`. The build puts no database client, no server
// auth module, no SDK wrapper and no telemetry key in a browser chunk. To learn
// what the browser takes from src/infrastructure/, you read that list.
//
// A route loader is a client context: @tanstack/router-core calls
// route.options.loader from the shared load path, which the browser runs too. Do
// not exempt a loader.
//
// A file named `*.server.ts` is a server context wherever it sits, so this rule
// does not check it. That exemption is about the BUNDLE — the file is never in a
// client chunk — and it is not a permission to import infrastructure. Inside a
// feature it usually is not one: `index.server.ts` classifies as the feature
// barrel and `notify.server.ts` as a feature-root file, and
// boundary/import-policy denies infrastructure to both. The rename removes this
// finding and creates that one.
//
// Each entry in `CLIENT_SAFE_INFRASTRUCTURE` matches the specifier EXACTLY. An
// entry that ends with `(?:\/|$)` instead of `$` admits a whole subtree, and the
// browser then gets every module in it.
//
// A relative specifier reaches the same module and no pattern here sees it.
// Adopt boundary/import-policy in the structural tier with this rule.
//
// SCOPE, and it is the same for every TREE-SCOPED rule in this catalog — which
// is every rule but `testing/no-module-mocking`, whose subject is a test file and
// which is therefore enabled globally. This rule is silent outside the declared
// trees, and silent on the files `isArchitectureExemptSourcePath` names inside
// them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { isServerContext } from "../../policy/declared-trees.ts";
import { classifySpecifier, classifyTargetPath } from "../../policy/layout.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

/**
 * The modules the browser may take from the adapter layer, RELATIVE to the
 * tree's infrastructure directory. Relative because the directory is vocabulary
 * and these two names are not: a project that calls its adapters `adapters/`
 * renames it once and this list follows.
 *
 * Each entry matches EXACTLY. An entry read as a prefix would admit a whole
 * subtree, and the browser then gets every module in it.
 */
const CLIENT_SAFE_INFRASTRUCTURE = ["auth/client", "providers/query-client"];

/**
 * The positions that only ever run on the server. Profiles rather than path
 * regexes, so a tree that renames a layer keeps the same exemption instead of
 * quietly losing it.
 */

export const clientServerInfraRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      serverOnlyInfraInClient:
        "Client contexts may only import client-safe infrastructure modules. From inside a feature, move it to controllers/ or to repo/ — or use the client-safe adapter. NOT service/, and NOT renaming the file to *.server.ts: a service layer imports no infrastructure at all, and a .server.ts at a feature root or as its barrel is a feature-root or feature-barrel file, which boundary/import-policy denies infrastructure to. Each of those silences this rule and lights up that one, and a pair of diagnostics forbidding each other's fix is an edit loop.",
    },
  },
  create(context, role) {
    if (isServerContext(role)) return {};

    const { vocabulary } = role.tree;
    const clientSafe = CLIENT_SAFE_INFRASTRUCTURE.map(
      (module) => `${vocabulary.infrastructureDir}/${module}`,
    );

    return visitModuleSources((source, specifier) => {
      const target = classifySpecifier(vocabulary, specifier);
      if (target?.kind !== "module") return;
      const to = classifyTargetPath(vocabulary, target.path);
      if (to?.area !== "infrastructure") return;
      if (clientSafe.includes(to.path)) return;
      context.report({ node: source, messageId: "serverOnlyInfraInClient" });
    });
  },
});
