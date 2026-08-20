// ─── types/no-reflect-access ─────────────────────────────────────────
//
// Makes sure: Property reads and calls keep their type checks. `Reflect.get`
// and `Reflect.apply` do not appear, in the dot or the bracket spelling. So a
// property rename reports at each read, and a call with the wrong number of
// arguments fails to compile rather than at run time.
//
// Only `get` and `apply` are in `BANNED_REFLECT_METHODS`. `Reflect.ownKeys`,
// `Reflect.has` and `Reflect.getPrototypeOf` return honest types and have no
// plain-syntax equivalent. Add `set` if the project has the same problem with
// property writes.
//
// A `Proxy` handler legitimately calls `Reflect.get` — that is the documented
// way to write a trap that forwards to the target. If the project has one,
// exempt its directory here rather than a disable comment in each trap.
//
// `Reflect` is resolved through the scope chain, not matched by name, so a
// local binding called `Reflect` does not report. The spec pins that.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { type ESTree, type Scope, type SourceCode } from "@oxlint/plugins";

// Keyed by `string` on purpose: every lookup is a member name read off the AST, so a map narrowed
// to its own two keys would refuse the only argument it is ever given. The VALUE side stays a
// literal union, which is what ties each entry to a `meta.messages` key.
const BANNED_REFLECT_METHODS = new Map<string, "reflectGet" | "reflectApply">([
  ["get", "reflectGet"],
  ["apply", "reflectApply"],
]);

// Both spellings of the member access. `Reflect["get"](…)` is the one a rule reading only
// `property.name` misses, and it is a single keystroke from the plain form.
function accessedMethodName(callee: ESTree.MemberExpression): string | null {
  if (callee.computed) {
    return callee.property.type === "Literal" && typeof callee.property.value === "string"
      ? callee.property.value
      : null;
  }
  return callee.property.type === "Identifier" ? callee.property.name : null;
}

// `sourceCode.isGlobalReference` is NOT usable here: oxlint 1.77.0 returns false for `Reflect`,
// because it only answers for globals its environment configuration declares. Asking the scope
// chain instead inverts the question — an identifier that resolves to no binding anywhere is the
// global one — which is both correct and independent of how the host is configured.
function isShadowedBinding(sourceCode: SourceCode, identifier: ESTree.IdentifierReference): boolean {
  let scope: Scope | null = sourceCode.getScope(identifier);
  while (scope !== null) {
    if (scope.set.has(identifier.name)) return true;
    scope = scope.upper;
  }
  return false;
}

export const noReflectAccessRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      reflectGet:
        "`Reflect.get` returns `any` whatever the receiver was. Use typed property access, or parse the dynamic input into a named type before reading it.",
      reflectApply:
        "`Reflect.apply` drops arity and parameter checking. Call the function directly, or spread a typed tuple if the arguments really are dynamic.",
    },
  },
  create(context) {

    return {
      CallExpression(node) {
        if (node.callee.type !== "MemberExpression") return;
        const owner = node.callee.object;
        // Resolved as a global rather than matched by name, so a local `const Reflect = …` — or an
        // import that shadows it — is correctly left alone.
        if (
          owner.type !== "Identifier" ||
          owner.name !== "Reflect" ||
          isShadowedBinding(context.sourceCode, owner)
        ) {
          return;
        }
        const method = accessedMethodName(node.callee);
        const messageId = method === null ? undefined : BANNED_REFLECT_METHODS.get(method);
        if (messageId !== undefined) context.report({ node, messageId });
      },
    };
  },
});
