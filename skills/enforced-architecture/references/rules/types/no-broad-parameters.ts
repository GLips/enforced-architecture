// ─── types/no-broad-parameters ───────────────────────────────────────
//
// Tag:      types
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: Function inputs typed `unknown` or `object` — the two ways
//           of accepting a value while declining to say what it is.
//
//             function save(value: object) {}
//             function handle(input: unknown) {}
//
//           `unknown` is the correct type at exactly one place: the
//           boundary where external data arrives and is immediately
//           parsed. Past that point it is a contract that pushes the
//           decision onto every caller and every reader. `object` is
//           worse in a quiet way — it admits every non-primitive and
//           supports no property read without a cast, so a signature
//           taking `object` cannot use what it was given.
//
//           Both are what a model writes when it has not decided what
//           the function receives, which is the decision a signature
//           exists to record. The fix is always the same: name the type
//           the caller already has, and parse external input once at
//           the boundary rather than everywhere downstream.
//
// Excludes: A parameter named `cause`. Error-cause enrichment
//           (`new Error(msg, { cause })`) genuinely receives an
//           unconstrained value from a `catch`, and TypeScript types
//           `catch` bindings as `unknown` for good reason. This is the
//           one honest `unknown` input and it is carved out by name.
//
// Applies:  All .ts and .tsx files EXCEPT:
//           - Test files and scripts
//
// Error:    unknown — "Parameter `{{parameter}}` accepts a value
//            without saying what it is. Name the type the caller
//            already has; run the schema or parser at the I/O boundary
//            instead of pushing `unknown` inward."
//           object  — "Parameter `{{parameter}}` uses the broad
//            `object` type, which admits every non-primitive and
//            supports no property read without a cast. Accept a named
//            type instead."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. The carve-out — `ALLOWED_UNKNOWN_PARAMETER_NAMES`:
//    Only `cause` is exempt, and by name rather than by position, so
//    the exemption stays greppable. A project with another genuinely
//    unconstrained input (a logger's `meta`, a serialiser's `value`)
//    adds the name here rather than weakening the match. Keep the list
//    short: every entry is a place the type system stops helping.
//
// 2. Splitting the two halves:
//    They are one rule because they share every visitor and the whole
//    annotation walk, and differ only in which keyword they reject.
//    A project wanting `object` allowed turns the objectParameter
//    branch off by emptying `OBJECT_KEYWORDS` — the message ids are
//    separate so the two can also be reported at different severities
//    if the plugin host supports it.
//
// 3. Boundary functions still need somewhere to stand:
//    This rule bans `unknown` on INPUTS, not the type itself. A parser
//    (`parseInvoice(input: unknown): Invoice`) is exactly the signature
//    the message asks for elsewhere, so if the project keeps parsers in
//    a known directory, exempt it here by path rather than teaching
//    everyone to disable the rule inline.
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-broad-parameters": noBroadParametersRule }`) and
//    turn it on in `.oxlintrc.json`
//    (`"<plugin>/no-broad-parameters": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
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

export const noBroadParametersRule = defineRule({
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
    if (isArchitectureExemptPath(context.filename)) return {};

    let aliases: ReadonlyMap<string, ESTree.TSType> = new Map();

    const checkParameters = (node: SignatureNode) => {
      const shadowed = lexicalTypeParameterNames(node);
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
