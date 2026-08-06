// ─── structure/server-fn-validation ──────────────────────────────────────
//
// Tag:      structure
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: Server functions that accept input without validation.
//           Every createServerFn whose handler consumes `data` must first
//           chain .validator() to validate input at
//           the server boundary. Unvalidated server functions accept
//           arbitrary client input — this is the primary injection
//           vector for bad data reaching the database or business
//           logic.
//
// Applies:  All src/** files that contain createServerFn calls.
//           Excludes test files and scripts.
//
// Error:    "createServerFn consumes handler data without .validator().
//            Add .validator(schema) before .handler() to validate
//            input at the server boundary."
//
// Negative space: The handler's PARAMETER LIST is the signal, not the
//                 factory's argument — that argument is always config
//                 (`{ method: "POST" }`), never client input. A handler
//                 passed by reference (`.handler(saveHandler)`) is not
//                 followed to its declaration and is not reported; the
//                 rule only reads a handler written inline.
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. Server function factory names — `SERVER_FN_FACTORIES`:
//    The identifiers a validated chain may bottom out in. Add the
//    project's wrapper if it wraps the factory
//    (`protectedServerFn`, `createServerAction`, …); a chain that bottoms
//    out in any other identifier is some other builder and is ignored.
//
// 2. Chain method names — `HANDLER_METHOD` and `VALIDATOR_METHOD`:
//    TanStack Start spells these .handler() and .validator(). Update both
//    together — and the message with them — for another framework.
//
// 3. Input detection — `PAYLOAD_PROPERTY`:
//    The handler consumes client input when its parameter destructures
//    `data`. A context-only handler (`async ({ context }) => …`) does not
//    require a validator; a handler that binds the whole options object
//    (`async (options) => …`) does, because `data` is reachable through it.
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "server-fn-validation": serverFnValidationRule }`) and turn
//    it on in `.oxlintrc.json` (`"<plugin>/server-fn-validation": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

const SERVER_FN_FACTORIES = new Set(["createServerFn"]);
const HANDLER_METHOD = "handler";
const VALIDATOR_METHOD = "validator";
const PAYLOAD_PROPERTY = "data";

/** The method names called on a builder chain, plus the bare identifier it bottoms out in. */
function readBuilderChain(handlerCall: ESTree.CallExpression): {
  factory: string | null;
  methods: string[];
} {
  const methods: string[] = [];
  let cursor: ESTree.Node = handlerCall;

  while (cursor.type === "CallExpression") {
    // Annotated rather than destructured: `cursor` is reassigned from this value, and TypeScript
    // reads the inferred pair as circular.
    const callee: ESTree.Expression = cursor.callee;
    if (callee.type === "Identifier") return { factory: callee.name, methods };
    if (callee.type !== "MemberExpression" || callee.computed) break;
    if (callee.property.type !== "Identifier") break;
    methods.push(callee.property.name);
    cursor = callee.object;
  }
  return { factory: null, methods };
}

/**
 * Reading `params` off the handler node is what keeps this robust. Any matcher written against the
 * handler's literal shape needs a slot for the `): Promise<T> =>` return-type annotation every real
 * handler carries — and in a typed codebase, a matcher missing that slot matches nothing at all.
 * Under a visitor the annotation is a sibling field of `params`, so it is simply not read.
 */
function handlerConsumesClientPayload(
  handler: ESTree.ArrowFunctionExpression | ESTree.FunctionExpression,
): boolean {
  const [param] = handler.params;
  if (param === undefined) return false;
  const binding = param.type === "AssignmentPattern" ? param.left : param;

  if (binding.type !== "ObjectPattern") {
    // An identifier or rest binding takes the whole options object, `data` included.
    return true;
  }
  return binding.properties.some((property) => {
    // `({ ...rest })` sweeps up `data` along with everything else.
    if (property.type === "RestElement") return true;
    if (property.computed) return false;
    const { key } = property;
    if (key.type === "Identifier") return key.name === PAYLOAD_PROPERTY;
    return key.type === "Literal" && key.value === PAYLOAD_PROPERTY;
  });
}

export const serverFnValidationRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      missingValidator:
        "createServerFn consumes handler data without .validator(). Add .validator(schema) before .handler() to validate input at the server boundary.",
    },
  },
  create(context) {
    if (isArchitectureExemptPath(context.filename)) return {};

    return {
      CallExpression(node) {
        const { callee } = node;
        if (
          callee.type !== "MemberExpression" ||
          callee.computed ||
          callee.property.type !== "Identifier" ||
          callee.property.name !== HANDLER_METHOD
        ) {
          return;
        }

        const [handler] = node.arguments;
        if (
          handler === undefined ||
          (handler.type !== "ArrowFunctionExpression" && handler.type !== "FunctionExpression")
        ) {
          return;
        }
        if (!handlerConsumesClientPayload(handler)) return;

        const { factory, methods } = readBuilderChain(node);
        if (factory === null || !SERVER_FN_FACTORIES.has(factory)) return;
        if (methods.includes(VALIDATOR_METHOD)) return;

        context.report({ node, messageId: "missingValidator" });
      },
    };
  },
});
