// ─── react/primed-suspense-reads ──────────────────────────────────────
//
// Makes sure: every suspense read goes through the tree's primed-read wrapper
// (`primedQueryModule()`), which in dev reports a read its route's loader did
// not prime. Only the wrapper imports `useSuspenseQuery` and its siblings from
// TanStack Query.
//
// Why a read must be primed: when a newly mounted Suspense boundary shows its
// fallback, React holds the content back until 300ms after the fallback showed
// (FALLBACK_THROTTLE_MS), however fast the read returns. An unprimed read on a
// cold navigation costs at least 300ms, and a warm cache hides it, so nobody
// sees it in review or on the second click.
//
// Why a wrapper and not a cache listener: a suspending render never subscribes
// its observer, so a QueryCache subscriber sees nothing during exactly the
// render that is the bug. The wrapper reads the cache at render time instead.
//
// The wrapper this rule assumes, written once per tree: `usePrimedSuspenseQuery`
// (and an infinite sibling) that, in dev and only after hydration (a
// `useSyncExternalStore` whose server snapshot is `false`), calls
// `queryClient.getQueryState(queryKey)`. With no data yet it logs the key, the
// path and a stack, once per key, then calls the real hook unchanged. `null`
// data is an answer, not a miss. Walk every route cold once after adopting it:
// the first sweep finds the reads nobody knew were unprimed.
//
// The escape hatch is not a suppression comment. A read no loader can know to
// prime (a picked row, an opened dialog) sits inside the wrapper module's
// deferred boundary — a Suspense with its own fallback that also sets a context
// the wrapper reads to stay quiet. The read still goes through the wrapper.
//
// NEGATIVE SPACE:
//   - The rule fences the import, not the priming. Whether a loader primed a
//     read is a runtime fact; the wrapper's dev report is what checks it, and
//     only on routes someone navigates to.
//   - `useQuery` is not fenced: it shows its own loading state and never
//     suspends, so it never meets the throttle.
//   - A `Suspense` boundary around an unprimed read is not fenced either. It
//     moves the fallback lower and still pays the throttle; the dev report
//     says so when the read happens.
//
// SCOPE, and it is the same for every TREE-SCOPED rule in this catalog — which
// is every rule but `testing/no-module-mocking`, whose subject is a test file and
// which is therefore enabled globally. This rule is silent outside the declared
// trees, and silent on the files `isArchitectureExemptSourcePath` names inside
// them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ──────────────────────────────────────────────────────────────────────

import { type ESTree } from "@oxlint/plugins";
import { isModule } from "../../policy/declared-trees.ts";
import { aliasSpecifierFor, primedQueryModule } from "../../policy/layout.ts";
import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { exportedName, visitImportedNames } from "../lib/imported-names.ts";
import { sourceOrderedReports } from "../lib/source-ordered-reports.ts";

const QUERY_MODULE = "@tanstack/react-query";
const SUSPENSE_HOOKS = new Set([
  "useSuspenseQuery",
  "useSuspenseInfiniteQuery",
  "useSuspenseQueries",
]);

export const primedSuspenseReadsRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      unprimedSuspenseHook:
        "Read through {{wrapper}}, not {{hook}} from {{vendor}}. In dev it reports a read the route's loader did not prime, which on a cold navigation holds the page until 300ms after its fallback. Prime the read in the loader; a read no loader can know about goes inside the deferred-reads boundary.",
    },
  },
  create(context, role) {
    const wrapperPath = primedQueryModule(role.tree.vocabulary);
    // The wrapper is the one module that must import the originals.
    if (isModule(role, wrapperPath)) return {};
    const ordered = sourceOrderedReports(context);

    const reportIfSuspenseHook = (node: ESTree.Node, hook: string) => {
      if (!SUSPENSE_HOOKS.has(hook)) return;
      ordered.report({
        node,
        messageId: "unprimedSuspenseHook",
        data: {
          hook,
          wrapper: aliasSpecifierFor(role.tree.vocabulary, wrapperPath),
          vendor: QUERY_MODULE,
        },
      });
    };

    return {
      ...visitImportedNames(context.sourceCode, [QUERY_MODULE], (hook, node) => {
        reportIfSuspenseHook(node, hook);
      }),

      // A re-export hands the original to every importer of this module, one keyword over.
      ExportNamedDeclaration(node) {
        if (node.source === null || node.source.value !== QUERY_MODULE) return;
        if (node.exportKind === "type") return;
        for (const specifier of node.specifiers) {
          if (specifier.exportKind === "type") continue;
          reportIfSuspenseHook(specifier, exportedName(specifier.local));
        }
      },

      // This rule owns `Program:exit` outright — see lib/source-ordered-reports.ts.
      "Program:exit"() {
        ordered.flushInSourceOrder();
      },
    };
  },
});
