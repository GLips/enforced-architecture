// ─── placement/deprecated-paths ─────────────────────────────────────────
//
// Tag:       placement
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: Imports from legacy directory paths that no longer exist
//           after an architecture migration. When directories are
//           relocated or renamed, old import paths linger in agent
//           memory and in code suggestions. This rule catches them
//           immediately and directs to the correct new location.
//
// Applies:  All src/** files EXCEPT test files and scripts.
//
// Error:    "The <old-path> directory no longer exists. Import from
//            <new-path> instead."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. `DEPRECATED_PATHS` — the fence itself:
//    Replace the entry with the project's actual deprecated import
//    paths. Each entry is a regex over the import specifier plus the
//    `messageId` naming its replacement.
//
//    Common migration patterns:
//      @/components/*   -> @/shared/ui/* or @/features/*/ui/*
//      @/lib/*          -> @/shared/*, @/infrastructure/*, or @/domains/*
//      @/utils/*        -> @/shared/*
//      @/helpers/*      -> @/shared/*
//      @/api/*          -> @/features/*/controllers/*
//      @/db/*           -> @/infrastructure/db/*
//      @/hooks/*        -> @/shared/* or @/features/*/ui/*
//      @/services/*     -> @/features/*/service/* or @/infrastructure/*
//
// 2. `meta.messages` — one entry per deprecated path:
//    Every deprecated path gets its OWN messageId, because the message
//    is the fix instruction: it must name the old path and the exact
//    directory the code moved to. A shared "this path is deprecated"
//    message forces the reader to go find the answer elsewhere.
//
// 3. Removing a deprecated path:
//    Once all imports from it are cleaned up and no agent is likely to
//    re-introduce them, delete its `DEPRECATED_PATHS` entry and its
//    message.
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "deprecated-paths": deprecatedPathsRule }`) and turn it
//    on in `.oxlintrc.json` (`"<plugin>/deprecated-paths": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
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
    const { filename } = context;
    if (isArchitectureExemptPath(filename)) return {};

    return visitModuleSources((source, specifier) => {
      for (const { pattern, messageId } of DEPRECATED_PATHS) {
        if (pattern.test(specifier)) context.report({ node: source, messageId });
      }
    });
  },
});
