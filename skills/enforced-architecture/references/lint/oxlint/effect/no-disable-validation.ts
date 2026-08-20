// ─── effect/no-disable-validation ─────────────────────────────────────
//
// Tag:       effect
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: `{ disableValidation: true }` passed to an Effect Schema
//           constructor —
//
//             Struct.make({ name: "" }, { disableValidation: true })
//             new Person({ id: 1, name: "" }, { disableValidation: true })
//
//           The constructor keeps its declared result type and drops the
//           check behind it, so the value arrives typed as `Person`
//           having never been proved to be one. Every downstream reader
//           then trusts a type nothing established — and the schema
//           that was supposed to be the evidence is still right there in
//           the line, which is what makes it read as safe.
//
//           This is the paired ban that any validation mandate needs. A
//           rule requiring a schema at the boundary is satisfied by a
//           schema call that validates nothing, so mandating the
//           validator and permitting its no-op form leaves the mandate
//           enforcing spelling. The catalog's stack-general version of
//           the mandate half is `placement/server-fn-validation`, whose
//           *Adapt* section names the same pairing for other validators.
//
// Applies:  All .ts and .tsx files EXCEPT test files and scripts.
//
// Error:    "disableValidation turns the constructor into a cast: the
//            value keeps the schema's type and nothing checks it against
//            the schema. Delete the option and fix the data or the
//            schema — and where the input genuinely may not conform,
//            decode with Schema.decodeUnknownEither and handle the
//            failure branch."
//
// Negative space: Three things this rule deliberately cannot see, each
//                 for a stated reason rather than an oversight:
//
//                 - The boolean shorthand. `Struct.make(props, true)`
//                   bypasses validation with no option name at all, and
//                   is indistinguishable from ordinary variadic
//                   construction — `Chunk.make(1, true)` is a two-element
//                   chunk. A rule reporting a bare `true` argument would
//                   fire on correct code often enough to be switched off.
//                 - An options object built in one statement and passed
//                   in another. There is no scope resolution in this
//                   tier; the rule reads the literal at the call site.
//                 - The option spread in from elsewhere
//                   (`{ ...parseOptions }`), which no per-file rule sees.
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. Which calls are schema construction — `SCHEMA_CONSTRUCTOR_METHODS`
//    and the `NewExpression` branch — is the primary knob:
//    Effect Schema takes this flag in exactly two places, verified
//    against the v3 documentation: the second argument of a default
//    constructor (`Struct.make`, `MyNumber.make`, `Invoice.make`) and
//    the second argument of a `Schema.Class` constructor (`new Person(…)`).
//    The decode / encode / validate families take `ParseOptions`, which
//    has no `disableValidation` field — matching them would be matching
//    an option the compiler already rejects. Add the project's own
//    factory names here if a wrapper forwards constructor options
//    (`makeUnsafe`, `of`, `fromRow`).
//
//    Scoping to those calls is what keeps the diagnostic true. Reported
//    on every object property in the file, it fires on an unrelated
//    API's `{ disableValidation: true }` with a message about schemas —
//    a false positive that also teaches the reader the rule does not
//    understand their code.
//
// 2. The opt-out being banned — `OPT_OUT_PROPERTY`:
//    The same shape covers any validator's escape hatch. Point the
//    constant at the option name (`skipValidation`, `unsafe`, `raw`),
//    repoint the call set, and rewrite both messages — they name the
//    fix, which is the whole value of the diagnostic.
//
// 3. Any non-`false` value reports, not just literal `true`.
//    A shorthand (`{ disableValidation }`), a forwarded flag, or a
//    ternary each leave validation off on some path, and a rule matching
//    only the literal teaches the retry rather than preventing it.
//    `disableValidation: false` is explicit and stays silent.
//
// 4. Where the exemption is worth removing — `isArchitectureExemptPath`:
//    Tests and scripts are exempt through
//    `../lib/architecture-exempt-paths.ts`, which is the catalog default.
//    This is the rule in the tag most worth un-exempting: a fixture built
//    with validation off is a fixture that could not exist in production,
//    and a suite full of them proves nothing about the running system.
//    Drop the guard to enforce it everywhere.
//
// 5. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-disable-validation": noDisableValidationRule }`) and
//    turn it on in `.oxlintrc.json`
//    (`"<plugin>/no-disable-validation": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

const OPT_OUT_PROPERTY = "disableValidation";
const SCHEMA_CONSTRUCTOR_METHODS = new Set(["make"]);

/** The property name when it is statically known — `x.name` or `x["name"]`, never `x[expr]`. */
function staticPropertyName(node: ESTree.MemberExpression): string | null {
  if (!node.computed) return node.property.type === "Identifier" ? node.property.name : null;
  return node.property.type === "Literal" && typeof node.property.value === "string"
    ? node.property.value
    : null;
}

/** The key, whether written bare, quoted, or computed from a string literal. */
function propertyKeyName(property: ESTree.Property): string | null {
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

export const noDisableValidationRule = defineRule({
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
    if (isArchitectureExemptPath(context.filename)) return {};

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
