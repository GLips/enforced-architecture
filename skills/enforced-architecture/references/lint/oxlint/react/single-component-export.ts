// ─── react/single-component-export ────────────────────────────────────
//
// Shows: The files that export more than one component. A component that
// shares a file has no file with its name. A text search for that name finds
// the uses and not the declaration. The message gives all of the names, thus
// you know which component to move.
//
// The `Object.assign` exemption must hold. It is the shape this rule's message
// tells people to write, and a report against it teaches people to ignore the
// rule. If a project groups compound components under one export some other
// way, add that spelling to `isCompoundNamespace`.
//
// Do not add a declaration form to this file. `lib/component-declarations.ts`
// answers "what is a component" for `react/hook-count` and `react/prop-count`
// too. A second answer here makes the three rules govern different sets of
// files.
//
// This rule gives a warning and does not stop the build. A second component in
// a file is sometimes correct, and only the author knows. The rule reports the
// names and leaves the decision to the author.
//
// SCOPE, and it is the same for every TREE-SCOPED rule in this catalog — which
// is every rule but `testing/no-module-mocking`, whose subject is a test file and
// which is therefore enabled globally. This rule is silent outside the declared
// trees, and silent on the files `isArchitectureExemptSourcePath` names inside
// them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { type ESTree } from "@oxlint/plugins";
import { isComponentFile, namesBarrel } from "../../policy/declared-trees.ts";
import { exportedComponents } from "../lib/component-declarations.ts";

export const singleComponentExportRule = defineTreeRule({
  meta: {
    type: "suggestion",
    messages: {
      multipleComponents:
        "This file exports {{names}}. Each is found by the name of this file rather than its own, so all but the first are invisible to a grep for where they are defined. Give each its own file, or namespace them under one export with Object.assign if they are genuinely a compound component.",
    },
  },
  create(context, role) {
    if (!isComponentFile(context.filename)) return {};
    // A barrel re-exports by design: every name in one is defined elsewhere.
    // The barrel's NAME comes from the tree, not from a literal — a tree that
    // renames its barrel would otherwise lose the exemption and get every
    // barrel reported.
    if (namesBarrel(role)) return {};

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
