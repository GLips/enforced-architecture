// ─── types/no-opaque-record ──────────────────────────────────────────
//
// Makes sure: No type is an open dictionary with an `unknown`, `any` or
// `object` value. That holds for `Record<string, unknown>`, an index signature,
// a mapped type with an open key domain, a union that collapses to `unknown`,
// and a local alias to any of them. So a misspelled key is a compile error and
// not `undefined` at run time, and a field rename reports at each read.
//
// `any` sits beside `unknown` in the opaque-value set. A ban on `unknown` alone
// teaches an agent to write `any` on the retry, which is the weaker type.
//
// WHICH open key domain it is, is not read. `Record<number, unknown>`,
// `Record<PropertyKey, unknown>` and `Record<any, unknown>` hold the same values
// as the string-keyed one. A test for `TSStringKeyword` looks more precise and
// creates a bypass. But whether the domain is open at all IS read, in every arm,
// and `lib/type-annotations.ts` owns that answer for the three rules that ask it.
// A closed domain names a shape: `{ [K in keyof T]: unknown }` is a dirty-field
// tracker, and so is `Record<keyof T, unknown>`.
//
// NEGATIVE SPACE, three of them, and all three follow from that one gate:
//   - `Record<'draft' | 'paid', unknown>` is silent. Its keys are closed, so a
//     misspelling is already a compile error — but its reads still need casts,
//     and NO rule in this catalog covers opaque values under a closed key domain.
//   - `Record<keyof T & string, unknown>` is silent: an intersection is closed
//     once any member is, and `keyof T` closes it. `keyof` is the one arm that
//     trusts a name it cannot read, because `Record<keyof Config, unknown>` over
//     an imported `Config` is the tracker this rule's own message asks for. The
//     price is that `keyof` of a type that is ITSELF a bag stays silent.
//   - a key domain the walk cannot RESOLVE reports even when it is finite in
//     fact — an IMPORTED alias, an imported enum, a member of an imported enum,
//     an enum nested in a `namespace`, a conditional type, an indexed access
//     into a named type (`Row['id']` is every string whenever `Row.id` is one),
//     a bare `typeof x` naming a local `const`, and `(typeof X)[…]` where `X` is
//     declared inside a function. What IS resolved is what this file declares at
//     top level: aliases, enums and their members, `as const` bindings, and the
//     key-preserving builtins. That is the safe direction, since the other
//     default goes silent on every key spelling nobody enumerated, and the fix
//     is to spell the union or name the shape.
//
// A schema or serialization layer that needs the open bag takes the recovery
// the second bullet above already allows — a CLOSED key domain — or, where the
// keys are unknown until run time, one `oxlint-disable-next-line` on that one
// type. No directory silences this rule, and the vocabulary names none for it.
// Do not loosen the type match instead: that silences every bag in the tree.
//
// `Record` is matched by name, not resolved. A project-local type also called
// `Record` reports. There is no type checker in this tier.
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
import {
  collectLocalTypeFacts,
  isOpaqueDictionaryValue,
  isOpenKeyDomain,
  type LocalTypeFacts,
} from "../lib/type-annotations.ts";

const RECORD_TYPE_NAME = "Record";

export const noOpaqueRecordRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      opaqueRecord:
        "Record<string, unknown> is an untyped bag: every read needs a cast and no key is checked. Declare the fields as a named type or interface, use Map<string, T> for open-ended runtime keys, or parse external input with a schema that returns a typed shape.",
      opaqueIndexSignature:
        "An index signature with an unknown/any value is Record<string, unknown> spelled differently — the same untyped bag. Declare the fields as a named type or interface, use Map<string, T> for open-ended runtime keys, or parse external input with a schema that returns a typed shape.",
    },
  },
  create(context) {

    // Collected before any type node is judged. Visitors fire in document order, so a `Program`
    // handler is the only place that sees an alias declared BELOW the use that resolves through
    // it — and type declarations are routinely ordered that way.
    // A file that names a type parameter after one of its own aliases must not resolve through the
    // alias: `<Opaque>(bag: Record<string, Opaque>)` is generic, not a bag. The visitor keys ride
    // along so each predicate asks that question at the node it is judging.
    let facts: LocalTypeFacts = {
      aliases: new Map(),
      enums: new Set(),
      constAsserted: new Set(),
      visitorKeys: context.sourceCode.visitorKeys,
    };

    return {
      Program(node) {
        facts = collectLocalTypeFacts(node, context.sourceCode.visitorKeys);
      },

      TSTypeReference(node) {
        if (node.typeName.type !== "Identifier") return;
        if (node.typeName.name !== RECORD_TYPE_NAME) return;

        // Two arguments read, arity unchecked — the same reading `dictionaryShape` uses, so this
        // rule and `types/no-widen-then-assert` cannot disagree about `Record<A, B, C>`.
        // Under- and over-applied `Record` are compile errors either way.
        const [key, value] = node.typeArguments?.params ?? [];
        if (key === undefined || value === undefined) return;
        if (!isOpenKeyDomain(key, facts)) return;
        if (isOpaqueDictionaryValue(value, facts)) {
          context.report({ node, messageId: "opaqueRecord" });
        }
      },

      // The index-signature and mapped-type forms are the same type with different syntax, so a
      // rule that only reads `Record<…>` is one keystroke from being bypassed — by an agent that is
      // not even trying to bypass it, since all three are idiomatic TypeScript for "a bag".
      //
      // The key is not consulted here and that is not the inconsistency it looks like: TypeScript
      // rejects a literal index-signature key (TS1336), so every one that compiles is already open.
      TSIndexSignature(node) {
        const value = node.typeAnnotation.typeAnnotation;
        if (isOpaqueDictionaryValue(value, facts)) {
          context.report({ node, messageId: "opaqueIndexSignature" });
        }
      },

      // The key domain is the `as` clause when there is one, and the constraint otherwise:
      // `{ [K in keyof T as string]: unknown }` has a closed constraint and open keys, so reading
      // the constraint alone calls that bag a shape.
      TSMappedType(node) {
        const value = node.typeAnnotation;
        if (!value) return;
        if (!isOpenKeyDomain(node.nameType ?? node.constraint, facts)) return;
        if (isOpaqueDictionaryValue(value, facts)) {
          context.report({ node, messageId: "opaqueIndexSignature" });
        }
      },
    };
  },
});
