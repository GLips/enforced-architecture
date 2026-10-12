// ─── react/mutation-refresh-keys ──────────────────────────────────────
//
// Makes sure: every write declares what it makes stale, and declares it in one
// place. Three findings, one invariant:
//
//   missingRefresh   A `useMutation` whose options never call the tree's
//                    refresh helper. The write lands; every view it changed
//                    keeps showing the old rows until a poll or a reload.
//   inlineKeys       A refresh handed an array literal, or anything that is not
//                    a name exported by the tree's query-keys module. Each call
//                    site listing its own keys is how one write of a kind
//                    refreshes the search index and its sibling forgets to: the
//                    knowledge "a board write also stales navigation" has to live
//                    in one bundle that every board write names.
//   directInvalidation
//                    `invalidateQueries`, `refetchQueries` or `resetQueries` on
//                    a query client anywhere but the refresh helper's own module —
//                    the spelling that refreshes without naming a bundle at all.
//
// The positions come from the tree's vocabulary: `queryKeysModule()` and
// `refreshAfterWriteModule()`. ANY function the refresh module exports counts as
// the helper and ANY name the keys module exports counts as a bundle, so the rule
// fences where a key list lives, not which spelling the project gave it.
//
// A write that genuinely stales nothing — a probe, a preview, a dry run — is
// named in the `readOnlyMutations` option, as `{ "<mutationFn name>": "<why>" }`.
// The name is what `mutationFn` calls: the identifier itself, or the callee of an
// expression-bodied arrow (`(data) => submitThing({ data })`). An entry with an
// empty reason exempts nothing. A reason that reads "the list polls anyway" is
// not read-only: the poll is the bug this rule reports, made slower.
//
// NEGATIVE SPACE:
//   - A write that bypasses `useMutation` entirely — a server function awaited
//     in an event handler — is not seen. Nothing in one file tells a write call
//     from a read call; the house convention that writes go through a mutation
//     hook is what this rule leans on.
//   - Options built elsewhere and passed as a variable (`useMutation(options)`)
//     report `unreadableOptions`: the refresh may be in there, and this rule
//     reads one object literal.
//   - A refresh wrapped in a local helper the options call is NOT followed, and
//     reads as `missingRefresh`. Deliberately: the wrapper is a second place the
//     keys live. Call the refresh helper in the options with the bundle.
//   - `removeQueries` and `setQueryData` are not fenced. Dropping a cached
//     not-found before a navigation is cache surgery, not a refresh, and the
//     write that does it still has to name its bundle.
//
// Unlike the rest of this folder, this rule reads every file in the tree and not
// only JSX: a mutation lives in a `use*.ts` hook module by this catalog's own
// placement rules.
// ──────────────────────────────────────────────────────────────────────

import type { ESTree, SourceCode } from "@oxlint/plugins";
import {
  classifySpecifier,
  normalizeSourcePath,
  queryKeysModule,
  refreshAfterWriteModule,
  type TreeVocabulary,
} from "../../policy/layout.ts";
import { isModule, type FileRole } from "../../policy/declared-trees.ts";
import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { hookCallName } from "../lib/hook-calls.ts";
import { staticKeyName } from "../lib/static-key-name.ts";

const MUTATION_HOOK = "useMutation";
const DIRECT_REFRESH_METHODS = new Set(["invalidateQueries", "refetchQueries", "resetQueries"]);

/** Each name a project declared read-only, with the reason it gave. Empty reasons drop out here. */
function readOnlyMutationNames(option: unknown): ReadonlySet<string> {
  if (typeof option !== "object" || option === null || !("readOnlyMutations" in option)) {
    return new Set();
  }
  const entries: unknown = option.readOnlyMutations;
  if (typeof entries !== "object" || entries === null) return new Set();
  return new Set(
    Object.entries(entries)
      .filter(([, reason]) => typeof reason === "string" && reason.trim() !== "")
      .map(([name]) => name),
  );
}

/**
 * The tree-relative module an identifier was imported from, or undefined when it is not an import.
 * Resolved through scope analysis, so a local binding shadowing the import is not the import.
 */
function importedModuleOf(
  identifier: ESTree.Node,
  sourceCode: SourceCode,
  role: FileRole,
): string | undefined {
  const scope = sourceCode.getScope(identifier);
  const reference = scope.references.find(
    (candidate) => candidate.identifier.range[0] === identifier.range[0],
  );
  for (const definition of reference?.resolved?.defs ?? []) {
    const declaration: ESTree.Node | null | undefined = definition.node.parent;
    if (declaration?.type !== "ImportDeclaration") continue;
    return treeModuleOf(declaration.source.value, role);
  }
  return undefined;
}

/** A specifier as a path from the tree's source root, for the alias spelling and relative ones. */
function treeModuleOf(specifier: string, role: FileRole): string | undefined {
  if (specifier.startsWith(".")) {
    const directory = role.sourcePath.split("/").slice(0, -1).join("/");
    return normalizeSourcePath(`${directory}/${specifier}`);
  }
  const classified = classifySpecifier(role.tree.vocabulary, specifier);
  return classified?.kind === "module" ? classified.path : undefined;
}

/** What `mutationFn` calls: the identifier, or the callee of an expression-bodied arrow. */
function mutationFunctionName(options: ESTree.ObjectExpression): string | undefined {
  for (const property of options.properties) {
    if (property.type !== "Property") continue;
    if (staticKeyName(property.key, property.computed) !== "mutationFn") continue;
    const value = property.value;
    if (value.type === "Identifier") return value.name;
    if (value.type === "ArrowFunctionExpression" && value.body.type === "CallExpression") {
      const callee = value.body.callee;
      return callee.type === "Identifier" ? callee.name : undefined;
    }
    return undefined;
  }
  return undefined;
}

function isInside(inner: ESTree.Node, outer: ESTree.Node): boolean {
  return inner.range[0] >= outer.range[0] && inner.range[1] <= outer.range[1];
}

export const mutationRefreshKeysRule = defineTreeRule({
  meta: {
    type: "problem",
    schema: [
      {
        type: "object",
        properties: { readOnlyMutations: { type: "object", additionalProperties: { type: "string" } } },
        additionalProperties: false,
      },
    ],
    messages: {
      missingRefresh:
        "This mutation refreshes nothing after it writes. Call the refresh helper from {{refreshModule}} in onSuccess with the bundle from {{keysModule}} that names every view this write stales. A write that stales nothing goes in the rule's readOnlyMutations option, with the reason.",
      inlineKeys:
        "Hand the refresh a bundle exported by {{keysModule}}, not a list built here. A key list per call site is how one write of a kind refreshes a view and its sibling forgets to; add or extend the bundle there, with a comment saying why it reaches what it reaches.",
      directInvalidation:
        "Refresh through the helper in {{refreshModule}} with a bundle from {{keysModule}}, not by calling {{method}} here.",
      unreadableOptions:
        "Pass useMutation an object literal so what it refreshes can be read where it is declared.",
    },
  },
  create(context, role) {
    const vocabulary: TreeVocabulary = role.tree.vocabulary;
    const keysModule = queryKeysModule(vocabulary);
    const refreshModule = refreshAfterWriteModule(vocabulary);
    // The helper's own module is where the client calls live; there is nothing to fence there.
    if (isModule(role, refreshModule) || isModule(role, keysModule)) return {};

    const readOnly = readOnlyMutationNames(context.options[0]);
    const names = { keysModule, refreshModule };
    const mutations: ESTree.ObjectExpression[] = [];
    const refreshes: ESTree.CallExpression[] = [];

    const isFrom = (node: ESTree.Node, module: string): boolean =>
      node.type === "Identifier" && importedModuleOf(node, context.sourceCode, role) === module;
    // A conditional choosing between two bundles still names a bundle on each path.
    const isBundle = (node: ESTree.Node | undefined): boolean => {
      if (node === undefined) return false;
      if (node.type === "ConditionalExpression") {
        return isBundle(node.consequent) && isBundle(node.alternate);
      }
      return isFrom(node.type === "CallExpression" ? node.callee : node, keysModule);
    };

    return {
      CallExpression(node) {
        const { callee } = node;
        if (callee.type === "MemberExpression") {
          const method = staticKeyName(callee.property, callee.computed);
          if (method !== undefined && DIRECT_REFRESH_METHODS.has(method)) {
            context.report({ node, messageId: "directInvalidation", data: { ...names, method } });
          }
        }

        if (isFrom(callee, refreshModule)) {
          refreshes.push(node);
          const keys = node.arguments[1];
          if (!isBundle(keys)) {
            context.report({ node: keys ?? node, messageId: "inlineKeys", data: names });
          }
          return;
        }

        if (hookCallName(callee, context.sourceCode) !== MUTATION_HOOK) return;
        const [options] = node.arguments;
        if (options?.type !== "ObjectExpression") {
          context.report({ node, messageId: "unreadableOptions" });
          return;
        }
        const name = mutationFunctionName(options);
        if (name !== undefined && readOnly.has(name)) return;
        mutations.push(options);
      },

      // A refresh call is recognised wherever it sits, so whether a mutation holds one is only
      // known once the whole file has been read.
      "Program:exit"() {
        for (const options of mutations) {
          if (refreshes.some((refresh) => isInside(refresh, options))) continue;
          context.report({ node: options, messageId: "missingRefresh", data: names });
        }
      },
    };
  },
});
