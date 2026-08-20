// ─── types/no-opaque-record ──────────────────────────────────────────
//
// Makes sure: No type is an open dictionary with an `unknown`, `any` or
// `object` value. That holds for `Record<string, unknown>`, an index signature,
// a mapped type with an open key domain, a union that collapses to `unknown`,
// and a local alias to any of them. So a misspelled key is a compile error and
// not `undefined` at run time, and a field rename reports at each read.
//
// `any` sits beside `unknown` in `OPAQUE_VALUE_TYPES`. A ban on `unknown`
// alone teaches an agent to write `any` on the retry, which is the weaker type.
//
// The key type is not read. `Record<number, unknown>` and
// `Record<PropertyKey, unknown>` hold the same values as the string-keyed one.
// A test for `TSStringKeyword` looks more precise and creates a bypass.
//
// A schema or serialization layer that needs the type gets a path test beside
// `isArchitectureExemptPath`, such as `/\/schemas?\//`. Do not loosen the type
// match instead: an exemption that names a directory stays greppable.
//
// `Record` is matched by name, not resolved. A project-local type also called
// `Record` reports. There is no type checker in this tier.
//
// SCOPE, and it is the same for every rule in this catalog: this rule is silent
// outside the declared trees, and silent on the files `isArchitectureExemptPath`
// names inside them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { type ESTree } from "@oxlint/plugins";

const RECORD_TYPE_NAME = "Record";

// `object` is here with `unknown` and `any` because as a dictionary VALUE it is the same bag: it
// admits every non-primitive and supports no property read without a cast. That is a different
// judgement from `object` in other positions, which is why this set governs values only.
const OPAQUE_VALUE_TYPES = new Set(["TSUnknownKeyword", "TSAnyKeyword", "TSObjectKeyword"]);

// A mapped type only builds the same bag when its key domain is open. `{ [K in keyof T]: unknown }`
// preserves a known shape and is a different thing entirely, so the constraint decides.
const UNBOUNDED_KEY_TYPE_NAMES = new Set(["PropertyKey"]);

// No parenthesis unwrapping here on purpose: oxlint's AST does not surface `TSParenthesizedType`,
// so `Record<string, (unknown)>` arrives as the bare keyword. Verified against oxlint 1.77.0 by
// asserting the parenthesized spelling still reports — the spec keeps that honest if it changes.
//
// `aliases` carries the file's local `type X = …` declarations so a value spelled through one is
// resolved before it is judged. Without it, `type Opaque = unknown` followed by
// `Record<string, Opaque>` is a one-line bypass of the whole rule — and unlike most bypasses in
// this catalog, that one reads as tidy code rather than evasion.
function isOpaqueValueType(
  type: ESTree.TSType,
  aliases: ReadonlyMap<string, ESTree.TSType>,
  visited: ReadonlySet<string> = new Set(),
): boolean {
  if (OPAQUE_VALUE_TYPES.has(type.type)) return true;

  // A union containing `unknown` or `any` IS `unknown` or `any` — TypeScript collapses it. So
  // `Record<string, unknown | string>` is the bag wearing a second member as cover. `object |
  // string` genuinely is a union and stays legal, which is why membership is tested per member
  // rather than by asking whether the union node itself is opaque.
  if (type.type === "TSUnionType") {
    return type.types.some(
      (member) => member.type === "TSUnknownKeyword" || member.type === "TSAnyKeyword",
    );
  }

  if (type.type !== "TSTypeReference" || type.typeName.type !== "Identifier") return false;
  const name = type.typeName.name;
  // A generic alias is not followed: its body is written in terms of parameters this rule cannot
  // substitute, so resolving it would report against a type argument that may never be opaque.
  if (visited.has(name)) return false;
  const alias = aliases.get(name);
  if (alias === undefined) return false;
  return isOpaqueValueType(alias, aliases, new Set([...visited, name]));
}

function isUnboundedKeyDomain(type: ESTree.TSType): boolean {
  if (type.type === "TSStringKeyword") return true;
  return (
    type.type === "TSTypeReference" &&
    type.typeName.type === "Identifier" &&
    UNBOUNDED_KEY_TYPE_NAMES.has(type.typeName.name)
  );
}

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

    const aliases = new Map<string, ESTree.TSType>();

    return {
      // Collected before any type node is judged. Visitors fire in document order, so a `Program`
      // handler is the only place that sees an alias declared BELOW the use that resolves through
      // it — and type declarations are routinely ordered that way.
      Program(node) {
        for (const statement of node.body) {
          const declaration =
            statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
          if (
            declaration?.type === "TSTypeAliasDeclaration" &&
            (declaration.typeParameters === null || declaration.typeParameters === undefined)
          ) {
            aliases.set(declaration.id.name, declaration.typeAnnotation);
          }
        }
      },

      TSTypeReference(node) {
        if (node.typeName.type !== "Identifier") return;
        if (node.typeName.name !== RECORD_TYPE_NAME) return;

        const params = node.typeArguments?.params ?? [];
        if (params.length === 2 && isOpaqueValueType(params[1], aliases)) {
          context.report({ node, messageId: "opaqueRecord" });
        }
      },

      // The index-signature and mapped-type forms are the same type with different syntax, so a
      // rule that only reads `Record<…>` is one keystroke from being bypassed — by an agent that is
      // not even trying to bypass it, since all three are idiomatic TypeScript for "a bag".
      TSIndexSignature(node) {
        if (isOpaqueValueType(node.typeAnnotation.typeAnnotation, aliases)) {
          context.report({ node, messageId: "opaqueIndexSignature" });
        }
      },

      TSMappedType(node) {
        if (!node.typeAnnotation) return;
        if (!isUnboundedKeyDomain(node.constraint)) return;
        if (isOpaqueValueType(node.typeAnnotation, aliases)) {
          context.report({ node, messageId: "opaqueIndexSignature" });
        }
      },
    };
  },
});
