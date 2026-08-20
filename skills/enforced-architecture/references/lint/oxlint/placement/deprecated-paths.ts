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
// ──────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { classifyFileRole } from "../../policy/declared-trees.ts";
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

export const deprecatedPathsRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      componentsDirectoryRemoved:
        "The @/components/ directory no longer exists. Import from @/shared/ui/* (generic primitives) or @/features/*/ui/* (feature-owned UI) instead.",
    },
  },
  create(context) {
    if (classifyFileRole(context.filename) === undefined) return {};

    return visitModuleSources((source, specifier) => {
      for (const { pattern, messageId } of DEPRECATED_PATHS) {
        if (pattern.test(specifier)) context.report({ node: source, messageId });
      }
    });
  },
});
