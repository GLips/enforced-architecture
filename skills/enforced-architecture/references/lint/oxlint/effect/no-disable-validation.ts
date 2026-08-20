// ─── effect/no-disable-validation ─────────────────────────────────────
//
// Makes sure: Every value that has a schema's type also passes that
// schema's check — through `Invoice.make(props, opts)` and through
// `new Person(props, opts)`. Add a field to a schema, and each
// construction that no longer conforms fails at the line that builds the
// value. You do not read a construction site to learn whether the type on
// it is evidence.
//
// Any value other than the literal `false` reports. A shorthand
// (`{ disableValidation }`), a forwarded flag, and a ternary each leave
// the check off on some path. Match the literal `true` alone, and the rule
// teaches the second spelling and stops nothing.
//
// The finding is anchored on the constructor call, not on the property
// name: an unrelated API's `{ disableValidation: true }` must not collect
// a message about schemas. Add a project name to the call set only where
// a wrapper forwards constructor options (`makeUnsafe`, `of`, `fromRow`).
//
// The boolean shorthand `Struct.make(props, true)` is the same bypass with
// no option name, and no per-file rule can see it: `Chunk.make(1, true)`
// is a two-element chunk. An options object built in another statement, or
// one spread in, is not something this rule can see, for the same reason.
//
// Tests and scripts are exempt by the catalog default, and this rule is
// the one most worth an exception: a fixture that skips validation could
// not exist in production.
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

const OPT_OUT_PROPERTY = "disableValidation";
const SCHEMA_CONSTRUCTOR_METHODS = new Set(["make"]);

/** The property name when it is statically known — `x.name` or `x["name"]`, never `x[expr]`. */
function staticPropertyName(node: ESTree.MemberExpression): string | null {
  if (!node.computed) return node.property.type === "Identifier" ? node.property.name : null;
  return node.property.type === "Literal" && typeof node.property.value === "string"
    ? node.property.value
    : null;
}

/**
 * The key, whether written bare, quoted, or computed from a string literal.
 *
 * The parameter is the full `Property` visitor union, not just the object-literal member: oxlint
 * fires that visitor for destructuring and assignment-target properties too, and all four kinds
 * carry the same `key`/`computed` pair. The ones that are not object literals are dropped by the
 * caller, on the parent, where the reason for dropping them can be written down.
 */
function propertyKeyName(
  property:
    | ESTree.ObjectProperty
    | ESTree.AssignmentTargetProperty
    | ESTree.BindingProperty,
): string | null {
  const { key } = property;
  if (!property.computed && key.type === "Identifier") return key.name;
  return key.type === "Literal" && typeof key.value === "string" ? key.value : null;
}

/** The last segment of a callee — `make` for all of `make`, `Struct.make`, `Schema.Struct.make`. */
function calleeMethodName(callee: ESTree.Node): string | null {
  if (callee.type === "Identifier") return callee.name;
  return callee.type === "MemberExpression" ? staticPropertyName(callee) : null;
}

// The option is only an opt-out where something reads it, and Effect Schema reads it in exactly two
// places. Anchoring on the call is what stops an unrelated API's identically named flag from
// collecting a diagnostic about schemas.
function isSchemaConstructorArgument(objectLiteral: ESTree.Node): boolean {
  const call = objectLiteral.parent;
  if (call === undefined || call === null) return false;
  if (call.type !== "CallExpression" && call.type !== "NewExpression") return false;
  if (!call.arguments.some((argument) => argument === objectLiteral)) return false;
  // `new Person(props, { … })` — the class IS the schema, so there is no method name to match.
  if (call.type === "NewExpression") return true;
  const method = calleeMethodName(call.callee);
  return method !== null && SCHEMA_CONSTRUCTOR_METHODS.has(method);
}

export const noDisableValidationRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      validationDisabled:
        "disableValidation turns the constructor into a cast: the value keeps the schema's type and nothing checks it against the schema. Delete the option and fix the data or the schema — and where the input genuinely may not conform, decode with Schema.decodeUnknownEither and handle the failure branch.",
      validationDisabledConditionally:
        "A runtime-valued disableValidation leaves the check off on some path, and no reader can tell which. Delete the option so every construction validates — if one caller needs to accept non-conforming input, give it its own schema that describes what it actually accepts.",
    },
  },
  create(context) {

    return {
      Property(node) {
        if (propertyKeyName(node) !== OPT_OUT_PROPERTY) return;
        // A destructuring pattern binds the name; it does not turn the check off. The call that
        // passes the object is the decision, and it is reported there.
        if (node.parent.type !== "ObjectExpression") return;
        if (!isSchemaConstructorArgument(node.parent)) return;

        const { value } = node;
        if (value.type === "Literal" && value.value === false) return;
        if (value.type === "Literal" && value.value === true) {
          context.report({ node, messageId: "validationDisabled" });
          return;
        }
        context.report({ node, messageId: "validationDisabledConditionally" });
      },
    };
  },
});
