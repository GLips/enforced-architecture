// ─── types/no-unknown-type-aliases ───────────────────────────────────
//
// Makes sure: No type name resolves to `unknown` or `any`, through any depth of
// local alias. A name in a signature states a contract, so you never follow
// `ApiPayload` through two files to learn that it decides nothing. It also
// closes the one-line alias that hides a broad type from the parameter rule and
// the return rule.
//
// Generic aliases are excluded. The body of `type Boxed<T> = T` is written in
// terms of parameters this tier cannot substitute.
//
// Only top-level aliases are collected, which matches `collectLocalTypeAliases`.
// A declaration inside a function or a namespace is not read. A project that
// nests type declarations needs a full walk in that module, and every rule that
// reads the module inherits the change.
//
// The overlap with `types/no-broad-parameters` and `types/no-unknown-returns`
// is deliberate: one file can report here AND at each use. That is not double
// counting. The alias is one defect and each use is another, and one edit to
// the alias clears them all.
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import { collectLocalTypeAliases, resolvesToBroadType } from "../lib/type-annotations.ts";

const BROAD_KEYWORDS = new Set(["TSUnknownKeyword", "TSAnyKeyword"]);

export const noUnknownTypeAliasesRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      unknownAlias:
        "Type alias `{{alias}}` names a contract and then declines to state one — it resolves to `unknown`. Keep `unknown` visible at the parse boundary where it is honest, and give this name the parsed type instead.",
    },
  },
  create(context) {
    if (isArchitectureExemptPath(context.filename)) return {};

    return {
      // Judged at Program rather than on TSTypeAliasDeclaration, because resolving one alias needs
      // every other alias in the file already collected — including those declared further down.
      Program(node) {
        const aliases = collectLocalTypeAliases(node);
        for (const [name, body] of aliases) {
          // The alias's own name is seeded as visited so a self-referential declaration terminates
          // rather than recursing until the stack gives out.
          if (!resolvesToBroadType(body, BROAD_KEYWORDS, aliases, new Set(), new Set([name]))) {
            continue;
          }
          const declaration = node.body
            .map((statement) =>
              statement.type === "ExportNamedDeclaration" ? statement.declaration : statement,
            )
            .find(
              (candidate) =>
                candidate?.type === "TSTypeAliasDeclaration" && candidate.id.name === name,
            );
          if (declaration?.type !== "TSTypeAliasDeclaration") continue;
          context.report({
            node: declaration.id,
            messageId: "unknownAlias",
            data: { alias: name },
          });
        }
      },
    };
  },
});
