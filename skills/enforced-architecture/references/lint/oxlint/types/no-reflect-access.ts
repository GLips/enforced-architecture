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
// local binding called `Reflect` does not report. The spec pins that, and pins
// the other half too — a `Reflect` bound in a scope the use site is not inside
// does not cover it.
//
// The resolution asks whether the binding has a DEFINITION SITE in the file, and
// that is not a detail: both shorter spellings of the question answer differently
// under the oxlint CLI than under RuleTester, so a rule reading either one is
// green in its spec and silent in the linter. `resolvesToLocalBinding` says which
// and why. Proving this rule fires therefore takes a real `oxlint` run over a real
// file, and no spec can substitute; the catalog does it in
// `harness/prove-no-reflect-access-live.ts`, and a project adapting this rule owes
// itself the equivalent.
//
// NEGATIVE SPACE. The subject is the identifier `Reflect` and the member read off
// it, so three spellings of the same access are deliberately not covered and no
// amount of scope resolution reaches them: `globalThis.Reflect.get(…)`, an alias
// (`const R = Reflect`), and a destructured method (`const { get } = Reflect`).
// Each hands back the same `any`. They are out because covering them means either
// tracking values, which one file's syntax cannot do honestly, or matching the
// member name alone, which reports every `cache.get(key)` in the codebase — and a
// rule that fires on correct code is one people learn to disable.
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

// Whether the name resolves to a binding THIS FILE declares a VALUE for, rather than to the
// language builtin.
//
// Two obvious ways to ask this are each right in exactly one of the two hosts the rule runs in,
// and silently wrong in the other. Measured on oxlint 1.77.0, both hosts:
//
//   under the oxlint CLI     the global scope declares `Reflect`, and `isGlobalReference` is true
//   under RuleTester         no global scope is populated, and `isGlobalReference` is false
//
// So `isGlobalReference` cannot be read — it answers opposite things about the same identifier.
// Neither can a scope-chain walk that looks the NAME up: under the CLI the global scope binds it
// for every use, so every use reads as shadowed and the rule reports nothing at all. A spec cannot
// catch either, because a spec runs in the host each one happens to be right in.
//
// Asking the RESOLVED REFERENCE agrees in both, and that is not a smaller version of the name
// lookup — it is a different question. A name lookup finds `type Reflect = never` and
// `interface Reflect {}`, which bind nothing at run time; the resolver skips them, because a
// VALUE reference does not resolve to a type-space binding. Getting that wrong is not a corner:
// `type Reflect = never;` is one line, compiles under `--strict`, leaves `Reflect.get` returning
// `any`, and would switch this rule off for the whole file. `lib/imported-names.ts` reaches for
// the resolver over a name lookup for exactly these cases, spelled `require`.
//
// An unresolved reference is the builtin — nothing in the file declares it. Under the CLI it
// resolves instead to a global-scope variable with no definitions, which says the same thing.
function resolvesToLocalBinding(
  sourceCode: SourceCode,
  identifier: ESTree.IdentifierReference,
): boolean {
  const scope = sourceCode.getScope(identifier);
  const reference = scope.references.find(
    (candidate) => candidate.identifier.range[0] === identifier.range[0],
  );
  const variable = reference?.resolved;
  if (variable === null || variable === undefined) return false;
  return variable.defs.some(bindsAValue);
}

// The two definition kinds the resolver hands back that still bind no value.
//
//   `declare const Reflect: …`   describes something that already exists. Nothing carrying
//       `declare` introduces a runtime binding — not a function, class, namespace or module —
//       and an ambient `.d.ts` never reaches this rule at all, so the arm has no legitimate
//       case to suppress.
//   `import type { Reflect }`    and its inline spelling `import { type Reflect }`. The resolver
//       does NOT skip these the way it skips a type alias, so both have to be read: `importKind`
//       sits on the DECLARATION for the first and on the SPECIFIER for the second.
//
// Both are otherwise one-line off-switches an adopter can write, which is the thing this catalog
// refuses. `lib/imported-names.ts` carries the same two reads for `require`; they are a fact
// about the TypeScript AST rather than a policy, and the third caller is where extracting one
// copy of it stops being premature — see ea-57.
function bindsAValue(definition: { node: ESTree.Node; parent: ESTree.Node | null }): boolean {
  if (isTypeOnlyImport(definition.node) || isTypeOnlyImport(definition.parent)) return false;
  // `declare` sits on the DECLARATION, and a `Variable` definition's node is the DECLARATOR
  // inside it, so reading the flag off `definition.node` finds nothing there and calls every
  // ambient declaration a real binding.
  const declaration = definition.node.type === "VariableDeclarator" ? definition.parent : definition.node;
  if (declaration === null) return true;
  return !("declare" in declaration && declaration.declare === true);
}

function isTypeOnlyImport(node: ESTree.Node | null): boolean {
  return node !== null && "importKind" in node && node.importKind === "type";
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
          resolvesToLocalBinding(context.sourceCode, owner)
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
