// ─── effect/no-nested-layer-provide ───────────────────────────────────
//
// Tag:       effect
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: A `Layer.provide` call sitting anywhere inside another
//           `Layer.provide` call's arguments —
//
//             Layer.provide(App, Layer.provide(Repo, Sql))
//             App.pipe(Layer.provide(Repo.pipe(Layer.provide(Sql))))
//
//           Nested inline, the tree stops being readable in the one
//           dimension that matters: which layer receives which
//           dependency, and therefore which requirements are still open
//           at the outer edge. The two spellings above are also not the
//           same composition, and nothing in the shape of the expression
//           says so.
//
//           Bind the inner layer to a named const and pass the name. The
//           wiring then reads top to bottom, each edge is one line, and
//           the layer becomes reusable — which is usually the reason it
//           was nested in the first place.
//
// Applies:  All .ts and .tsx files EXCEPT test files and scripts.
//
// Error:    "A Layer.provide inside another Layer.provide's arguments
//            hides which layer receives which dependency. Bind the inner
//            layer to a named const and pass that name, so each edge of
//            the composition is one readable line."
//
// Negative space: Sequential provides on one pipeline
//                 (`App.pipe(Layer.provide(A), Layer.provide(B))`) are
//                 flat, not nested, and are left alone — they are the
//                 shape this rule pushes toward.
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. Namespace and method — `LAYER_NAMESPACES` and `PROVIDE_METHOD`:
//    `provide` is far too common a method name to match alone, so the
//    receiver must be one of the listed namespaces. Add the project's
//    alias if it imports the module under another name
//    (`import * as L from "effect/Layer"`), and add `provideMerge` to a
//    method set if its nesting should read the same way — it composes
//    differently but is just as unreadable nested.
//
// 2. Containment is by source range, not by argument position.
//    The inner call is a finding wherever it sits in the outer call's
//    arguments — one level down, inside a `.pipe(…)`, or inside a
//    `Layer.merge(…)` between them. A rule reading only the direct
//    arguments passes every pipe-spelled nest, which is the spelling
//    Effect code is actually written in.
//
// 3. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-nested-layer-provide": noNestedLayerProvideRule }`)
//    and turn it on in `.oxlintrc.json`
//    (`"<plugin>/no-nested-layer-provide": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree, type Range } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

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

export const noNestedLayerProvideRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      nestedLayerProvide:
        "A Layer.provide inside another Layer.provide's arguments hides which layer receives which dependency. Bind the inner layer to a named const and pass that name, so each edge of the composition is one readable line.",
    },
  },
  create(context) {
    if (isArchitectureExemptPath(context.filename)) return {};

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
