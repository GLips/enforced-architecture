// ─── types/no-broad-parameters ───────────────────────────────────────
//
// Makes sure: Every parameter names what it accepts. No input is `unknown` or
// `any`, so the body reads the value with no guard of its own. No input is
// `object`, so no property read needs a cast, and a wrong argument fails at the
// call site rather than inside the function.
//
// A parameter named `cause` is exempt. A `catch` binding is `unknown`, so the
// value passed to `new Error(msg, { cause })` has no type to name. The
// exemption is by name and not by position, so it stays greppable. Keep
// `ALLOWED_UNKNOWN_PARAMETER_NAMES` short: each entry is a place where the type
// system gives no help.
//
// The rule bans `unknown` on INPUTS, not the type itself. A parser
// (`parseInvoice(input: unknown): Invoice`) is the signature the rest of this
// tag asks for. Keep parsers in a known directory and exempt that directory
// here by path, rather than a disable comment on each parser.
//
// SCOPE, and it is the same for every rule in this catalog: this rule is silent
// outside the declared trees, and silent on the files `isArchitectureExemptPath`
// names inside them — tests, scripts, generated and ambient modules. Neither
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
} from "../lib/type-annotations.ts";

type SignatureNode = ESTree.Node & { params: ESTree.ParamPattern[] };

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
      for (const parameter of node.params) {
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
