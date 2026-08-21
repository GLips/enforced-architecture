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
// `Reflect` is resolved as a REFERENCE, not matched by name, so a local binding
// called `Reflect` does not report. The spec pins that, and pins the other half
// too — a `Reflect` bound in a scope the use site is not inside does not cover it.
//
// The question the resolution asks is whether the binding puts a VALUE in the file,
// and that is not a detail: both shorter spellings of it answer differently
// under the oxlint CLI than under RuleTester, so a rule reading either one is
// green in its spec and silent in the linter. `resolvesToLocalBinding` says which
// and why. Proving this rule fires therefore takes a real `oxlint` run over a real
// file, and no spec can substitute; the catalog does it in
// `harness/prove-no-reflect-access-live.ts`, and a project adapting this rule owes
// itself the equivalent.
//
// NEGATIVE SPACE. The subject is the identifier `Reflect` and the member read off
// it, so every spelling that puts the builtin somewhere else first is out of reach
// and stays that way. `globalThis.Reflect.get(…)` names it through another object;
// `const R = Reflect` and — cheapest of all — `const Reflect = globalThis.Reflect`
// rebind it, the second without touching a single call site; `const { get } =
// Reflect` takes the method off it. Each hands back the same `any`. Covering them
// means either tracking values, which one file's syntax cannot do honestly, or
// matching the member name alone, which reports every `cache.get(key)` in the
// codebase — and a rule that fires on correct code is one people learn to disable.
// A codebase that wants the whole family closed wants a type-aware check, which no
// rule in this catalog is.
//
// REPORTS CORRECT CODE, in one shape and its alias: a `namespace Reflect` with value
// members really does bind the name, as does an `import Reflect = <that namespace>`,
// and this reports on both. `bindsAValue` says why the erased kinds and the
// instantiated ones are refused together, and the spec asserts the cost rather than
// leaving it to this paragraph.
//
// Not reachable through an adopter's config, which is the obvious next attack and
// worth stating: declaring `Reflect` in oxlint's `globals` or turning on an `env`
// that carries it changes what the global SCOPE holds and not what any definition
// says, and this reads definitions. Measured on 1.77.0.
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
import { staticKeyName } from "../lib/static-key-name.ts";
import { withoutTransparentWrappers } from "../lib/transparent-wrappers.ts";
import { type ESTree, type Scope, type SourceCode } from "@oxlint/plugins";

// Keyed by `string` on purpose: every lookup is a member name read off the AST, so a map narrowed
// to its own two keys would refuse the only argument it is ever given. The VALUE side stays a
// literal union, which is what ties each entry to a `meta.messages` key.
const BANNED_REFLECT_METHODS = new Map<string, "reflectGet" | "reflectApply">([
  ["get", "reflectGet"],
  ["apply", "reflectApply"],
]);

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
// Neither can a scope-chain walk that looks the NAME up. It gets the SHADOWING wrong: a name is
// bound by every declaration that spells it, in value space and type space alike, so a `type
// Reflect = never` inside a function hides the real `const Reflect` outside it and the rule fires
// on a call that is genuinely local. A reference resolves to the binding the CALL uses. (The name
// walk is also what made this rule inert, when it returned on any binding at all rather than
// asking each definition — the CLI's global scope binds `Reflect` for every use.)
//
// Asking the RESOLVED REFERENCE agrees in both, and an unresolved one is the builtin — nothing in
// the file declares it. Under the CLI it resolves instead to a global-scope variable with no
// definitions, which says the same thing. `lib/imported-names.ts` reaches for the resolver over a
// name lookup for the same reason, spelled `require`.
//
// The walk to `upper` is not the old name walk coming back. A reference is recorded on the scope
// that CONTAINS it, which for a `switch` discriminant is the scope above the one `getScope`
// returns — so a lookup in one scope misses it, `resolved` comes back undefined, and the rule
// reports on a local binding it should have left alone. That was a live false positive on
// `switch (Reflect.get(…))` with a `const Reflect` in the file.
// Takes the identifier as a plain `Node`, because it arrives through
// `withoutTransparentWrappers` — which answers "what is this value" and cannot know that this
// caller narrowed it to an identifier. The two fields read here are on every identifier node.
function resolvesToLocalBinding(sourceCode: SourceCode, identifier: ESTree.Node): boolean {
  let scope: Scope | null = sourceCode.getScope(identifier);
  while (scope !== null) {
    const reference = scope.references.find(
      (candidate) => candidate.identifier.range[0] === identifier.range[0],
    );
    if (reference !== undefined) {
      const variable = reference.resolved;
      return variable !== null && variable.defs.some(bindsAValue);
    }
    scope = scope.upper;
  }
  // No scope records this reference. Not observed — every identifier oxlint hands a visitor is
  // recorded somewhere — and `false` means "not a local binding", which reports. It is the same
  // direction the resolver's own `null` takes two lines up, and the same one an unforeseen
  // definition kind takes in `bindsAValue`: this rule's failure mode is silence, so no default
  // here chooses it.
  return false;
}

// Whether one definition of the resolved variable puts a value in the file at run time.
//
// Asked per definition and not per variable, because TypeScript MERGES declarations into one:
// `interface Reflect {…}` beside `declare const Reflect: Reflect` is a single variable with two
// definitions, and reading only the first said "this file binds Reflect" about two declarations
// that between them bind nothing. Both halves compile under `--strict` and emit the call verbatim.
//
// Three ways a definition binds nothing, each a one-line file-wide off-switch otherwise:
//
//   a type-space KIND       `type Reflect = never` and `interface Reflect {}`. The resolver skips
//       these when they stand alone — a value reference resolves past them to the builtin — but
//       NOT when they merge with a value declaration, which is why the kind is read here rather
//       than left to the resolver. `Definition["type"]` as `@oxlint/plugins` declares it does not
//       list these; the runtime produces them, measured.
//   `declare`               describes something that already exists. Nothing carrying it
//       introduces a runtime binding — const, function, class, namespace or module — and an
//       ambient `.d.ts` never reaches this rule at all, so the arm suppresses no legitimate case.
//   a type-only import      `import type { Reflect }` and `import { type Reflect }`. The resolver
//       does NOT skip these the way it skips a type alias, so both spellings have to be read:
//       `importKind` sits on the DECLARATION for the first and on the SPECIFIER for the second.
//   an alias to an ENTITY    `import Reflect = NodeJS`, which is a one-line off-switch in any
//       project carrying `@types/node` — or `= JSX` in any React one — and erases to nothing at
//       all. Its definition claims `importKind: "value"` on both the node and its parent, which
//       is why the arm above does not catch it. The `= require("…")` spelling of the same syntax
//       DOES bind a value and is left alone, so the moduleReference is what separates them.
//
// NEGATIVE SPACE, in the false-positive direction, and it is the reason `TSModuleName` is refused
// by kind rather than by inspection: an INSTANTIATED namespace — `namespace Reflect { export const
// get = … }` — does bind a value, and this reports on it. Telling it from the erased kind means
// reimplementing TypeScript's instantiation rule, to buy silence on a namespace shadowing a
// language builtin. A real instance is one `oxlint-disable-next-line`; the uninstantiated half
// left open is a file-wide off-switch with no bound.
//
// `TSEnumName` is deliberately absent from the list, and that is a verdict rather than an
// omission: an enum emits a real object, so the name really is bound. The ambient spellings that
// do erase — `declare enum` — carry the `declare` flag and are refused by the arm below.
const TYPE_SPACE_DEFINITIONS: readonly string[] = ["Type", "TSModuleName"];

function bindsAValue(definition: { type: string; node: ESTree.Node; parent: ESTree.Node | null }): boolean {
  if (TYPE_SPACE_DEFINITIONS.includes(definition.type)) return false;
  if (isTypeOnlyImport(definition.node) || isTypeOnlyImport(definition.parent)) return false;
  if (isEntityAlias(definition.node)) return false;
  // `declare` sits on the DECLARATION, and a `Variable` definition's node is the DECLARATOR
  // inside it — so reading the flag off `definition.node` alone calls every ambient `const` a real
  // binding. The other arm is not a fallback: a `declare class Reflect` and a `declare enum` carry
  // the flag on the definition's OWN node, with no declarator to climb out of, and reading only
  // `parent` there misses them.
  const declaration = definition.node.type === "VariableDeclarator" ? definition.parent : definition.node;
  // Unreachable — every definition kind that reaches here carries a node. `false` is the direction
  // an unforeseen one should take: it means "binds nothing", which REPORTS. Silence is the failure
  // this rule shipped with, and a default that picks it is a default that hides.
  if (declaration === null) return false;
  return !("declare" in declaration && declaration.declare === true);
}

function isTypeOnlyImport(node: ESTree.Node | null): boolean {
  return node !== null && "importKind" in node && node.importKind === "type";
}

// `import X = A.B` names something that already exists; `import X = require(…)` loads a module and
// binds it. One syntax, and the moduleReference is the only thing that separates them — the
// definition's `importKind` says `"value"` for both.
//
// It is not the same as separating "binds a value" from "does not": an alias to an INSTANTIATED
// entity emits `var X = A.B` and does bind one, and this refuses it. That is the instantiation
// question again, one indirection further out, and it takes the same verdict for the same reason —
// see the note in `bindsAValue`.
function isEntityAlias(node: ESTree.Node): boolean {
  return (
    node.type === "TSImportEqualsDeclaration" &&
    node.moduleReference.type !== "TSExternalModuleReference"
  );
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
        // TWO places a node can be wedged in, and both leave the source reading `Reflect.get`.
        // `Reflect.get!(…)` and `(Reflect.get as Getter)(…)` wrap the CALLEE — the member
        // expression itself — and beat a matcher reading `node.callee` directly.
        // `(Reflect as never).get(…)` and `Reflect!.get(…)` wrap the callee's OBJECT. Neither is
        // visible to a reader, and `Reflect.get!(…)` emits byte-identical JS to the plain form.
        // `lib/transparent-wrappers.ts` owns which nodes those are, for the reason
        // `types/no-type-argument-assertion` gives: a wrapped callee and a wrapped value are one
        // question, and a rule holding its own list of the answer is how the two drift.
        const callee = withoutTransparentWrappers(node.callee);
        if (callee.type !== "MemberExpression") return;
        const owner = withoutTransparentWrappers(callee.object);
        // Resolved as a global rather than matched by name, so a local `const Reflect = …` — or an
        // import that shadows it — is correctly left alone.
        if (
          owner.type !== "Identifier" ||
          owner.name !== "Reflect" ||
          resolvesToLocalBinding(context.sourceCode, owner)
        ) {
          return;
        }
        // `lib/static-key-name.ts` owns both spellings of the member read, and owns the negative
        // space with them: a key no single file can follow is `undefined` rather than a guess.
        const method = staticKeyName(callee.property, callee.computed);
        const messageId = method === undefined ? undefined : BANNED_REFLECT_METHODS.get(method);
        if (messageId !== undefined) context.report({ node, messageId });
      },
    };
  },
});
