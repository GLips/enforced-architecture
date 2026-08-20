// ─── types/no-reflect-access ─────────────────────────────────────────
//
// Tag:      types
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: `Reflect.get` and `Reflect.apply` — the two ways of doing
//           ordinary work while stepping outside the type system.
//
//             const value = Reflect.get(owner, key);
//             const result = Reflect.apply(operation, owner, args);
//
//           `Reflect.get` returns `any` whatever the receiver was, so a
//           typed object goes in and an untyped value comes out.
//           `Reflect.apply` does the same to a call: the argument list
//           is an array, so arity and parameter types stop being
//           checked. Neither is doing anything ordinary syntax cannot,
//           which is what makes them a tell — they appear when a model
//           cannot get a property access or a call to type-check and
//           reaches for the form the compiler will not argue with.
//
//           Both rules are one file because they are one decision: they
//           share the global-resolution logic and a project that wants
//           one almost always wants the other.
//
// Excludes: The rest of `Reflect`. `Reflect.ownKeys`, `Reflect.has`,
//           and `Reflect.getPrototypeOf` have no plain-syntax
//           equivalent and return honest types.
//
// Applies:  All .ts and .tsx files EXCEPT:
//           - Test files and scripts
//
// Error:    get   — "`Reflect.get` returns `any` whatever the receiver
//            was. Use typed property access, or parse the dynamic input
//            into a named type before reading it."
//           apply — "`Reflect.apply` drops arity and parameter
//            checking. Call the function directly, or spread a typed
//            tuple if the arguments really are dynamic."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. Which methods — `BANNED_REFLECT_METHODS`:
//    Only `get` and `apply` are listed. Add `set` if the project has
//    the same problem writing properties; leave `ownKeys` and `has`
//    alone, since they return real types and have no plain equivalent.
//
// 2. Genuine metaprogramming needs a home:
//    A `Proxy` handler legitimately uses `Reflect.get` — that is the
//    documented way to write a forwarding trap. If the project has one,
//    exempt its directory here rather than teaching everyone to disable
//    the rule inline.
//
// 3. `Reflect` is resolved, not matched by name:
//    A local binding called `Reflect` does not report. This is what
//    separates the rule from a text search, and the spec pins it.
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-reflect-access": noReflectAccessRule }`) and turn
//    it on in `.oxlintrc.json`
//    (`"<plugin>/no-reflect-access": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree, type Scope, type SourceCode } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

const BANNED_REFLECT_METHODS = new Map([
  ["get", "reflectGet"],
  ["apply", "reflectApply"],
] as const);

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

export const noReflectAccessRule = defineRule({
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
    if (isArchitectureExemptPath(context.filename)) return {};

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
