// ─── react/single-component-export ────────────────────────────────────
//
// Tag:       react
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  No — a warning. Two components in one file is a smell, and the
//            author decides whether the second one has earned its own file.
//
// Prevents:  Two exported components in one file. Both are then found by the
//            name of the FILE rather than their own, so the second is invisible
//            to a grep for where it is defined.
//
// The declaration forms this has to see live in `lib/component-declarations.ts`,
// shared with `react/hook-count` and `react/prop-count`. See
// react/single-component-export.md for why the classifier tests the bound value
// rather than the exported name, and why the compound exemption exists.
//
// ── Adapt ──
// The compound exemption is `Object.assign`. A project that namespaces compound
// components some other way names that spelling in `isCompoundNamespace`.
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath, isComponentFile } from "../lib/architecture-exempt-paths.ts";
import { exportedComponents } from "../lib/component-declarations.ts";

export const singleComponentExportRule = defineRule({
  meta: {
    type: "suggestion",
    messages: {
      multipleComponents:
        "This file exports {{names}}. Each is found by the name of this file rather than its own, so all but the first are invisible to a grep for where they are defined. Give each its own file, or namespace them under one export with Object.assign if they are genuinely a compound component.",
    },
  },
  create(context) {
    if (isArchitectureExemptPath(context.filename) || !isComponentFile(context.filename)) return {};
    // A barrel re-exports by design: every name in one is defined elsewhere.
    if (context.filename.endsWith("/index.tsx")) return {};

    // A compound component namespaced under one export is the sanctioned shape, and it is what
    // this rule's own message recommends — so the exemption has to hold, or the rule tells people
    // to do something that fails. Recorded on the way past because the `Object.assign` call sits
    // BELOW the components it namespaces.
    let compound = false;

    return {
      CallExpression(node) {
        if (isCompoundNamespace(node.callee)) compound = true;
      },

      "Program:exit"(program) {
        if (compound) return;
        const components = exportedComponents(program);
        const extra = components[1];
        if (extra === undefined) return;

        context.report({
          // The extra component is the one a reader acts on, not the first.
          node: extra.node,
          messageId: "multipleComponents",
          data: { names: components.map((component) => component.name).join(", ") },
        });
      },
    };
  },
});

/** `Object.assign(…)`, the one shape that turns several components into a single export. */
function isCompoundNamespace(callee: ESTree.CallExpression["callee"]): boolean {
  return (
    callee.type === "MemberExpression" &&
    !callee.computed &&
    callee.object.type === "Identifier" &&
    callee.object.name === "Object" &&
    callee.property.type === "Identifier" &&
    callee.property.name === "assign"
  );
}
