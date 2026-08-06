// ─── react/no-direct-fetch ────────────────────────────────────────────
//
// Tag:      react
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: Direct fetch() calls in React component files (.tsx).
//           Components should use server functions, TanStack Query,
//           or other data-fetching abstractions — not raw fetch.
//           Raw fetch in components leads to:
//           - No caching, deduplication, or background refetching
//           - Manual loading/error state management
//           - Race conditions on rapid re-renders
//           - Inconsistent data-fetching patterns across the codebase
//
// Applies:  All .tsx files EXCEPT:
//           - Test files and scripts
//           - Non-.tsx files (.ts utility files may legitimately use fetch
//             in infrastructure wrappers, SDK clients, etc.)
//
// Error:    "Direct fetch() calls in component files bypass the
//            data-fetching layer. Use a server function or TanStack
//            Query hook instead."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. File scope — `isComponentFile`:
//    Only .tsx files are checked. Broaden the predicate in
//    `../lib/architecture-exempt-paths.ts` if components also live in
//    .jsx files. Do NOT extend it to .ts — infrastructure wrappers and
//    SDK clients legitimately use fetch, and the .ts/.tsx split is the
//    whole boundary this rule leans on.
//
// 2. Allowed directories — the `isArchitectureExemptPath` guard:
//    Tests and scripts are already exempt. If the project has other .tsx
//    files that legitimately use fetch (Storybook mock providers, MSW
//    handlers), add a path check beside that guard.
//
// 3. What counts as the global — `FETCH_GLOBAL` and `GLOBAL_OBJECTS`:
//    A project's own wrapper (`apiFetch()`, `authFetch()`) is fine and
//    is not matched: the rule anchors on the exact callee name, so only
//    a bare `fetch(…)` or an explicit `globalThis.fetch(…)` /
//    `window.fetch(…)` is a finding. A method named `fetch` on some
//    client object is somebody else's API, not the global.
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-direct-fetch": noDirectFetchRule }`) and turn it on
//    in `.oxlintrc.json` (`"<plugin>/no-direct-fetch": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import {
  isArchitectureExemptPath,
  isComponentFile,
} from "../lib/architecture-exempt-paths.ts";

const FETCH_GLOBAL = "fetch";
const GLOBAL_OBJECTS = new Set(["globalThis", "window", "self"]);

// `window.fetch(url)` is the same request as `fetch(url)`, and it is the spelling a name-only
// pattern misses. A `fetch` method on anything else is a different API and is left alone.
function isGlobalFetch(callee: ESTree.Expression): boolean {
  if (callee.type === "Identifier") return callee.name === FETCH_GLOBAL;
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    GLOBAL_OBJECTS.has(callee.object.name) &&
    callee.property.type === "Identifier" &&
    callee.property.name === FETCH_GLOBAL
  );
}

export const noDirectFetchRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      directFetch:
        "Direct fetch() calls in component files bypass the data-fetching layer. Use a server function or TanStack Query hook instead.",
    },
  },
  create(context) {
    const { filename } = context;
    if (!isComponentFile(filename) || isArchitectureExemptPath(filename)) return {};

    return {
      CallExpression(node) {
        if (isGlobalFetch(node.callee)) {
          context.report({ node, messageId: "directFetch" });
        }
      },
    };
  },
});
