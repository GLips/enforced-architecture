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
// WHICH open key domain it is, is not read. `Record<number, unknown>` and
// `Record<PropertyKey, unknown>` hold the same values as the string-keyed one.
// A test for `TSStringKeyword` looks more precise and creates a bypass. But
// whether the domain is open at all IS read, in every arm — `lib/type-annotations.ts`
// owns that answer. A closed domain names a shape: `{ [K in keyof T]: unknown }`
// is a dirty-field tracker, and so is the `Record<keyof T, unknown>` spelling of
// it, which reported here until the two arms were made to agree.
//
// NEGATIVE SPACE: `Record<'draft' | 'paid', unknown>` is therefore silent. Its
// keys are closed, so a misspelling is already a compile error — but its reads
// still need casts, and no rule in this catalog covers opaque values under a
// closed key domain. That silence is not coverage.
//
// A schema or serialization layer that needs the type gets a path test beside
// `isArchitectureExemptSourcePath`, such as `/\/schemas?\//`. Do not loosen the type
// match instead: an exemption that names a directory stays greppable.
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
import { type ESTree } from "@oxlint/plugins";
import {
  collectLocalTypeAliases,
  isOpaqueDictionaryValue,
  isOpenKeyDomain,
  lexicalTypeParameterNames,
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
    let aliases: ReadonlyMap<string, ESTree.TSType> = new Map();

    // A file that names a type parameter after one of its own aliases must not resolve through the
    // alias: `<Opaque>(bag: Record<string, Opaque>)` is generic, not a bag.
    const shadowedAt = (node: ESTree.Node) =>
      lexicalTypeParameterNames(node, context.sourceCode.visitorKeys);

    return {
      Program(node) {
        aliases = collectLocalTypeAliases(node);
      },

      TSTypeReference(node) {
        if (node.typeName.type !== "Identifier") return;
        if (node.typeName.name !== RECORD_TYPE_NAME) return;

        const params = node.typeArguments?.params ?? [];
        const [key, value] = params;
        if (params.length !== 2 || key === undefined || value === undefined) return;
        const shadowed = shadowedAt(node);
        if (!isOpenKeyDomain(key, aliases, shadowed)) return;
        if (isOpaqueDictionaryValue(value, aliases, shadowed)) {
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
        if (isOpaqueDictionaryValue(node.typeAnnotation.typeAnnotation, aliases, shadowedAt(node))) {
          context.report({ node, messageId: "opaqueIndexSignature" });
        }
      },

      TSMappedType(node) {
        if (!node.typeAnnotation) return;
        const shadowed = shadowedAt(node);
        if (!isOpenKeyDomain(node.constraint, aliases, shadowed)) return;
        if (isOpaqueDictionaryValue(node.typeAnnotation, aliases, shadowed)) {
          context.report({ node, messageId: "opaqueIndexSignature" });
        }
      },
    };
  },
});
