// ─── types/no-broad-parameters ───────────────────────────────────────
//
// Makes sure: Every parameter names what it accepts. No input is `unknown` or
// `any`, so no body outside a type guard reads a value it has to check first.
// No input is `object`, so no property read needs a cast, and a wrong argument
// fails at the call site rather than inside the function.
//
// A parameter named `cause` is exempt. A `catch` binding is `unknown`, so the
// value passed to `new Error(msg, { cause })` has no type to name. The
// exemption is by name and not by position, so it stays greppable. Keep
// `ALLOWED_UNKNOWN_PARAMETER_NAMES` short: each entry is a place where the type
// system gives no help.
//
// The value a type guard vouches for is exempt too — the subject of
// `value is InvoiceId` or `asserts value is InvoiceId`. A guard exists to give a
// type to input that has none, so demanding one is asking for the answer as the
// question; `types/no-runtime-typeof` tells you to write exactly this signature.
// That exemption is a fact about the return annotation, not a list, so it is not
// configurable. It reaches ONLY the parameters the predicates name: a second
// broad input on a guard still reports, and a predicate over `this` vouches for
// the receiver, which is not a parameter, so it exempts none. An overloaded
// guard declares its predicate on a signature and widens the implementation's
// return type, so both the function and the method spelling of that set are read
// through to the signature — `lib/type-annotations.ts` owns that reading, and
// `types/no-runtime-typeof` shares it so the two rules cannot disagree about
// what a guard is.
//
// The rule bans `unknown` on INPUTS, not the type itself. A parser
// (`parseInvoice(input: unknown): Invoice`) is the signature the rest of this
// tag asks for, and its parameter still reports. Two spellings answer that.
// Write the check as a guard or an assertion and the predicate exemption above
// already covers it; a parser that must hand back a VALUE takes one
// `oxlint-disable-next-line` at that function. There is no directory to point
// at instead: this catalog has no per-rule path exemption, and the one
// path-shaped silence a tree can name — `generatedDir`, read through
// `isArchitectureExemptSourcePath` — takes EVERY rule off what it names.
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
  FUNCTION_SIGNATURE_NODES,
  lexicalTypeParameterNames,
  parameterAnnotation,
  parameterName,
  resolvesToBroadType,
  type SignatureNode,
  typePredicateSubjectPositions,
} from "../lib/type-annotations.ts";

const UNKNOWN_KEYWORDS = new Set(["TSUnknownKeyword", "TSAnyKeyword"]);
const OBJECT_KEYWORDS = new Set(["TSObjectKeyword"]);

// `catch` binds `unknown`, so the value forwarded into an Error's `cause` genuinely has no type to
// name. Exempting by parameter name rather than by position keeps the hole searchable.
const ALLOWED_UNKNOWN_PARAMETER_NAMES = new Set(["cause"]);

export const noBroadParametersRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      unknownParameter:
        "Parameter `{{parameter}}` accepts a value without saying what it is. Name the type the caller already has; run the schema or parser at the I/O boundary instead of pushing `unknown` inward.",
      objectParameter:
        "Parameter `{{parameter}}` uses the broad `object` type, which admits every non-primitive and supports no property read without a cast. Accept a named type instead.",
    },
  },
  create(context) {

    let aliases: ReadonlyMap<string, ESTree.TSType> = new Map();

    const checkParameters = (node: SignatureNode) => {
      const shadowed = lexicalTypeParameterNames(node, context.sourceCode.visitorKeys);
      const vouchedFor = typePredicateSubjectPositions(node, context.sourceCode);
      for (const [position, parameter] of node.params.entries()) {
        if (vouchedFor.has(position)) continue;
        const annotation = parameterAnnotation(parameter);
        if (annotation === null || annotation === undefined) continue;
        const declared = annotation.typeAnnotation;
        const name = parameterName(parameter, context.sourceCode);

        if (resolvesToBroadType(declared, UNKNOWN_KEYWORDS, aliases, shadowed)) {
          if (ALLOWED_UNKNOWN_PARAMETER_NAMES.has(name)) continue;
          context.report({ node: declared, messageId: "unknownParameter", data: { parameter: name } });
          continue;
        }
        if (resolvesToBroadType(declared, OBJECT_KEYWORDS, aliases, shadowed)) {
          context.report({ node: declared, messageId: "objectParameter", data: { parameter: name } });
        }
      }
    };

    return {
      Program(node) {
        aliases = collectLocalTypeAliases(node);
      },
      ...Object.fromEntries(FUNCTION_SIGNATURE_NODES.map((kind) => [kind, checkParameters])),
    };
  },
});
