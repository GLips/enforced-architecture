// ─── placement/server-fn-validation ──────────────────────────────────────
//
// Makes sure: A createServerFn handler that reads `data` calls .validator()
// first. Client input reaches a database write or a domain function only after
// a schema checks it. You do not test the payload shape a second time inside
// the handler body before you trust what it stores.
//
// The handler's parameter list is the signal, not the factory's argument. That
// argument is config (`{ method: "POST" }`) and never client input. A handler
// that binds the whole options object (`async (options) => …`) reaches `data`
// through it and needs a validator too.
//
// Move the handler out to a named function and the report stops. The rule reads
// a handler written inline and does not follow `.handler(saveHandler)` to its
// declaration.
//
// Ban the validator's no-op forms in the same change. This rule mandates a call
// to `.validator()` and cannot see whether the schema checks anything. Every
// validation library has a spelling that checks nothing: `z.any()`,
// `z.unknown()`, a `.passthrough()` object, an empty `z.object({})` against a
// payload with fields. Each one satisfies this rule and leaves the boundary as
// open as before. `z.any()` is also what an agent writes when this rule blocks
// it and the real schema is not obvious. `effect/no-disable-validation` bans
// those forms for Effect Schema and names the constants to repoint for another
// library.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { type ESTree } from "@oxlint/plugins";

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
  handler: ESTree.ArrowFunctionExpression | ESTree.Function,
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

export const serverFnValidationRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      missingValidator:
        "createServerFn consumes handler data without .validator(). Add .validator(schema) before .handler() to validate input at the server boundary.",
    },
  },
  create(context) {

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
