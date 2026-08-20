// ─── react/no-direct-fetch ────────────────────────────────────────────
//
// Makes sure: No .tsx file calls the global fetch, bare or through
// `globalThis`, `window` or `self`. Every request from the UI goes through a
// server function or a query hook. Two components that ask for the same data
// make one request and share one cache entry. A retry, an auth header, or a
// timeout goes in one module, and no component writes it again.
//
// The rule matches the exact callee name. A project's own wrapper —
// `apiFetch()`, `authFetch()` — is no finding, and neither is a `fetch`
// method on a client object, which is somebody else's API. Widen the match to
// every name that contains `fetch`, and the rule reports the wrappers it asks
// people to write.
//
// Do not extend `isComponentFile` to .ts. An infrastructure wrapper or an SDK
// client is where the global belongs, and the .ts/.tsx split is the whole
// boundary this rule reads. A wider predicate looks like more coverage and
// instead reports the module that every component calls.
//
// The rule assumes the project has a better place for a request. On a project
// with neither a server function nor a query library, it blocks the only
// option a component has.
//
// The messages below name TanStack Query. That name is the fix instruction, not a
// detail: a project on SWR, on Apollo, or on a route loader must edit the message
// text to name what it uses. A message that names a package the project does not
// have tells the reader to install one.
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
