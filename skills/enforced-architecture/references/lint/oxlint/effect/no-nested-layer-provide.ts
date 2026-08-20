// ─── effect/no-nested-layer-provide ───────────────────────────────────
//
// Makes sure: Every composed layer has a name, and each `Layer.provide`
// edge is one line. You read a runtime's layer graph as a list of names,
// and not as one expression that nests `Layer.provide` inside another
// through a `.pipe(…)` chain. To use the same composition in a test
// runtime, you import the name.
//
// Containment is by source range, not by argument position. The inner call
// is a finding wherever it sits in the outer call's arguments: one level
// down, inside a `.pipe(…)`, or inside a `Layer.merge(…)` between them. A
// rule that reads the direct arguments only passes every pipe-spelled
// nest, which is the spelling most Effect code uses.
//
// `provide` is far too common a method name to match alone, so the
// receiver must be one of the listed namespaces. Add the project's alias
// for `import * as L from "effect/Layer"`. Drop the namespace test and the
// rule reports every unrelated `provide` in the tree.
//
// Sequential provides on one pipeline
// (`App.pipe(Layer.provide(A), Layer.provide(B))`) are flat, not nested,
// and get no finding. They are the shape this rule asks for.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { type ESTree, type Range } from "@oxlint/plugins";

const LAYER_NAMESPACES = new Set(["Layer"]);
const PROVIDE_METHOD = "provide";

/** The property name when it is statically known — `x.name` or `x["name"]`, never `x[expr]`. */
function staticPropertyName(node: ESTree.MemberExpression): string | null {
  if (!node.computed) return node.property.type === "Identifier" ? node.property.name : null;
  return node.property.type === "Literal" && typeof node.property.value === "string"
    ? node.property.value
    : null;
}

function isLayerProvideCall(node: ESTree.CallExpression): boolean {
  const { callee } = node;
  if (callee.type !== "MemberExpression") return false;
  if (callee.object.type !== "Identifier" || !LAYER_NAMESPACES.has(callee.object.name)) return false;
  return staticPropertyName(callee) === PROVIDE_METHOD;
}

export const noNestedLayerProvideRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      nestedLayerProvide:
        "A Layer.provide inside another Layer.provide's arguments hides which layer receives which dependency. Bind the inner layer to a named const and pass that name, so each edge of the composition is one readable line.",
    },
  },
  create(context) {

    // The walk is pre-order, so an outer call is visited before anything nested in it — the
    // containment question is only answerable once every call in the file has been seen.
    const provideCalls: ESTree.CallExpression[] = [];
    const argumentSpans: Range[] = [];

    return {
      CallExpression(node) {
        if (!isLayerProvideCall(node)) return;
        provideCalls.push(node);

        const first = node.arguments[0];
        const last = node.arguments[node.arguments.length - 1];
        // The span covers the arguments only, never the callee, so a call can never contain itself.
        if (first !== undefined && last !== undefined) {
          argumentSpans.push([first.range[0], last.range[1]]);
        }
      },

      "Program:exit"() {
        for (const call of provideCalls) {
          const [start, end] = call.range;
          const nested = argumentSpans.some(([spanStart, spanEnd]) => start >= spanStart && end <= spanEnd);
          if (nested) context.report({ node: call, messageId: "nestedLayerProvide" });
        }
      },
    };
  },
});
