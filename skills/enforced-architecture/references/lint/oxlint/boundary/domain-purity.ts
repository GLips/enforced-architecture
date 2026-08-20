// ─── boundary/domain-purity ──────────────────────────────────────────
//
// Tag:      boundary
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: Aliased and package runtime imports outside domains and shared.
//           boundary/cross-boundary-alias governs relative boundary crossings.
//           Global side effects require separate enforcement.
//
// Applies:  All src/domains/** files EXCEPT test files and scripts.
//
// Error:    "Domains may runtime-import only domains, shared modules, and
//            explicit pure-package exceptions. Pass side-effectful
//            dependencies from the caller."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. The domain directory — `DOMAIN_LAYER`:
//      /src/domains/   — standard (this template)
//      /src/domain/    — singular naming
//      /src/core/      — if you call your domain layer "core"
//
// 2. The allowlist — `PERMITTED_DOMAIN_IMPORT`:
//    Relative specifiers plus `@/domains` and `@/shared`. Add pure
//    packages deliberately, one alternative at a time. A pure utility
//    with no IO is a candidate; a validator is a harder call, because
//    parsing usually belongs at the boundary and a domain should receive
//    values already validated. Each addition is a decision, not a
//    convenience — if the list grows past a handful, the layer has
//    stopped being a domain layer. The alias arms are closed with
//    `(?:\/|$)` so `@/domains-legacy` is not mistaken for `@/domains`.
//
// 3. Alias prefix: change `@/domains` and `@/shared` in that same
//    pattern if the project uses another alias for src/.
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "domain-purity": domainPurityRule }`) and turn it on in
//    `.oxlintrc.json` (`"<plugin>/domain-purity": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import { visitModuleSources } from "../lib/module-source-visitor.ts";

const DOMAIN_LAYER = /\/src\/domains\//;
const PERMITTED_DOMAIN_IMPORT = /^\.|^@\/(?:domains|shared)(?:\/|$)/;

/**
 * A type import creates no runtime dependency, so a domain may name any type it likes.
 *
 * The declaration-level `import type` / `export type` is the easy half. The half that matters is
 * the inline spelling: `import { type Stats, readFile } from "node:fs"` has `importKind: "value"`
 * at the declaration and still binds `readFile` at runtime, so only an import whose every specifier
 * is type-only is erased. A bare `import "pkg"` has no specifiers at all and is pure side effect —
 * the `length > 0` guard is what keeps it a violation.
 */
function isTypeOnlyDeclaration(declaration: ESTree.Node): boolean {
  switch (declaration.type) {
    case "ImportDeclaration":
      return (
        declaration.importKind === "type" ||
        (declaration.specifiers.length > 0 &&
          declaration.specifiers.every(
            (specifier) =>
              specifier.type === "ImportSpecifier" && specifier.importKind === "type",
          ))
      );
    case "ExportNamedDeclaration":
      return (
        declaration.exportKind === "type" ||
        (declaration.specifiers.length > 0 &&
          declaration.specifiers.every((specifier) => specifier.exportKind === "type"))
      );
    case "ExportAllDeclaration":
      return declaration.exportKind === "type";
    default:
      // An ImportExpression is always a runtime dependency: `import type` has no dynamic form.
      return false;
  }
}

export const domainPurityRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      impureDomainImport:
        "Domains may runtime-import only domains, shared modules, and explicit pure-package exceptions. Pass side-effectful dependencies from the caller.",
    },
  },
  create(context) {
    const { filename } = context;
    if (!DOMAIN_LAYER.test(filename) || isArchitectureExemptPath(filename)) return {};

    return visitModuleSources((source, specifier) => {
      if (PERMITTED_DOMAIN_IMPORT.test(specifier)) return;
      if (isTypeOnlyDeclaration(source.parent)) return;
      context.report({ node: source, messageId: "impureDomainImport" });
    });
  },
});
