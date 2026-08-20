// ─── types/no-unknown-type-aliases ───────────────────────────────────
//
// Tag:      types
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: A named type that resolves to nothing:
//
//             type ExternalValue = unknown;
//             type ApiPayload = ExternalValue;
//
//           The name promises a contract and the body declines to
//           provide one. That is worse than writing `unknown` at every
//           use, because the name suppresses the question — a reader
//           who sees `ApiPayload` believes a decision was made
//           somewhere, and there is no somewhere.
//
//           It is also the natural escape from every other rule in this
//           tag. `types/no-broad-parameters` and
//           `types/no-unknown-returns` both resolve local aliases for
//           exactly this reason; this rule closes the hole at the
//           declaration instead, so the alias cannot be written at all
//           rather than merely being seen through at each use.
//
// Excludes: Generic aliases (`type Boxed<T> = T`), whose body is
//           written in terms of parameters this tier cannot substitute.
//
// Applies:  All .ts and .tsx files EXCEPT:
//           - Test files and scripts
//
// Error:    "Type alias `{{alias}}` names a contract and then declines
//            to state one — it resolves to `unknown`. Keep `unknown`
//            visible at the parse boundary where it is honest, and give
//            this name the parsed type instead."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. Reporting on the NAME, not the body:
//    The diagnostic points at `alias.id` so the message lands on the
//    identifier a reader would search for. Point it at
//    `typeAnnotation` instead if the project prefers the error on the
//    offending type.
//
// 2. Top-level aliases only:
//    Declarations nested inside functions or namespaces are not
//    collected, matching `collectLocalTypeAliases`. A project that
//    nests type declarations meaningfully needs a full walk there, and
//    every rule reading that module inherits the change.
//
// 3. Interaction with the rest of the tag:
//    This rule and the two resolving rules overlap on purpose — one
//    file can report here AND at each use. That is not double
//    counting: the alias is one defect and each use is another, and
//    fixing the alias clears them all at once.
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-unknown-type-aliases": noUnknownTypeAliasesRule }`)
//    and turn it on in `.oxlintrc.json`
//    (`"<plugin>/no-unknown-type-aliases": "error"`).
//
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
