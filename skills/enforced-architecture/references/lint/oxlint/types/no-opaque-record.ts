// ─── types/no-opaque-record ──────────────────────────────────────────
//
// Tag:      types
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: `Record<string, unknown>` and the other spellings of the
//           same untyped bag:
//
//             Record<string, unknown>      Record<string, any>
//             { [key: string]: unknown }   { [K in string]: unknown }
//
//           A value typed this way carries no information. Every read
//           needs a cast the compiler cannot check, every write is
//           accepted whatever the key, and a typo in a key name is a
//           silent `undefined` rather than an error. It is the type an
//           agent reaches for when it has not decided what the data is
//           — which is exactly the decision the type is supposed to
//           record.
//
//           The three fixes the message names, in order of preference:
//           declare the fields as a named type; use `Map<string, T>`
//           when the keys really are open-ended runtime data; or parse
//           external input with a schema so the boundary produces a
//           typed shape and `unknown` stops at that boundary.
//
// Excludes: `unknown` on its own (`(input: unknown)` is the correct way
//           to receive unvalidated data), `Record<K, ConcreteType>`, and
//           shape-preserving mapped types (`{ [K in keyof T]: unknown }`),
//           whose key domain is closed.
//
// Applies:  All .ts and .tsx files EXCEPT:
//           - Test files and scripts
//
// Error:    "Record<string, unknown> is an untyped bag: every read needs
//            a cast and no key is checked. Declare the fields as a named
//            type or interface, use Map<string, T> for open-ended runtime
//            keys, or parse external input with a schema that returns a
//            typed shape."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. What counts as an opaque value — `OPAQUE_VALUE_TYPES`:
//    `unknown` and `any` are both here because banning only `unknown`
//    teaches an agent to write `any` on the retry — the weaker of the
//    two. Drop `TSAnyKeyword` if a separate `no-explicit-any` already
//    covers it, and add `TSObjectKeyword` to also reject
//    `Record<string, object>`.
//
// 2. The key type is deliberately not read.
//    `Record<number, unknown>` and `Record<PropertyKey, unknown>` are
//    the same bag as the string-keyed one, so the rule matches on the
//    value alone. To narrow it to string keys, test
//    `params[0].type === "TSStringKeyword"` in `TSTypeReference`.
//
// 3. Where the bag is legitimate — `isArchitectureExemptPath`:
//    Tests and scripts are exempt through `../lib/architecture-exempt-paths.ts`.
//    A project whose schema or serialization layer genuinely needs the
//    type adds a path test beside that call (`/\/schemas?\//`) rather
//    than weakening the match — an exemption that names a directory
//    keeps the escape hatch greppable, which a loosened pattern does not.
//
// 4. The name `Record` is matched textually, not resolved.
//    A project-local type also called `Record` would be flagged. That
//    is the trade every per-file rule in this catalog makes; there is no
//    type checker in this tier.
//
// 5. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-opaque-record": noOpaqueRecordRule }`) and turn it
//    on in `.oxlintrc.json` (`"<plugin>/no-opaque-record": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

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

export const noOpaqueRecordRule = defineRule({
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
    if (isArchitectureExemptPath(context.filename)) return {};

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
