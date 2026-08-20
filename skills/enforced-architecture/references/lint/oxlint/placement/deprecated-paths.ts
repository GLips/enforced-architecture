// ─── placement/deprecated-paths ─────────────────────────────────────────
//
// Makes sure: No file imports a path that a migration removed. You delete
// `src/components/` once and it stays deleted, because the next import of
// `@/components/*` fails the lint and the message names the directory that
// holds the code now. You do not search the tree for old paths after each
// change an agent writes.
//
// Each deprecated path keeps its own messageId. The message is the fix
// instruction, thus it names the old path and the exact directory the code
// moved to. One shared "this path is deprecated" message sends the reader
// somewhere else for the answer.
//
// Delete an entry only after the last import of that path is gone. An entry
// removed while agents still write the old path from memory is the point where
// the migration reverses, and no report follows.
//
// The rule reads the specifier and says the old path is gone. Whether the new
// path is one this file may import at all is boundary/import-policy's finding.
//
// SCOPE, and it is the same for every TREE-SCOPED rule in this catalog — which
// is every rule but `testing/no-module-mocking`, whose subject is a test file and
// which is therefore enabled globally. This rule is silent outside the declared
// trees, and silent on the files `isArchitectureExemptSourcePath` names inside
// them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ──────────────────────────────────────────────────────────────────────

import { aliasSpecifierFor, sharedUiDir } from "../../policy/layout.ts";
import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

// Anchored at the head of the specifier and closed on the trailing slash, so a live directory whose
// name merely starts the same way — `@/components-registry/` — does not inherit the deprecation.
//
// Only the alias form is fenced. A relative specifier (`../../components/card`) resolves against the
// importing file's own directory, and a per-file lint has no project root to resolve it against; the
// alias is what agents actually reproduce from memory anyway.
const DEPRECATED_PATHS = [
  { pattern: /^@\/components\//, messageId: "componentsDirectoryRemoved" },
] as const;

export const deprecatedPathsRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      componentsDirectoryRemoved:
        "The @/components/ directory no longer exists. Import from {{sharedUi}}/* (generic primitives) or {{featureUi}}/*/{{uiLayer}}/* (feature-owned UI) instead.",
    },
  },
  create(context, role) {
    const { vocabulary } = role.tree;
    const data = {
      sharedUi: aliasSpecifierFor(vocabulary, sharedUiDir(vocabulary)),
      featureUi: aliasSpecifierFor(vocabulary, vocabulary.featuresDir),
      uiLayer: vocabulary.featureLayerDirs.ui,
    };

    return visitModuleSources((source, specifier) => {
      for (const { pattern, messageId } of DEPRECATED_PATHS) {
        if (pattern.test(specifier)) context.report({ node: source, messageId, data });
      }
    });
  },
});
