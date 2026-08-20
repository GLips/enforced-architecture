// ─── types/no-unknown-returns ────────────────────────────────────────
//
// Tag:      types
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: Functions whose declared return contract is `unknown`,
//           `any`, or a wrapper around one — `Promise<unknown>`,
//           `unknown[]`, a local alias to either.
//
//             function loadUser(): unknown { … }
//             async function fetchRow(): Promise<unknown> { … }
//
//           An `unknown` input is a question. An `unknown` return is an
//           answer that refuses to answer — and it is strictly worse,
//           because a parameter is the caller's problem to satisfy once
//           while a return is every caller's problem forever. Each one
//           must narrow the value again, none of them can agree on how,
//           and the first thing every caller writes is the assertion
//           this tag exists to prevent.
//
//           A function that has done the work of producing a value
//           knows what it produced. Returning `unknown` throws that
//           knowledge away at the one point in the program where it was
//           most cheaply available.
//
// Excludes: Inferred returns. The rule reads the DECLARED annotation
//           only — a function with no return type is left to
//           TypeScript's inference, which is precise by construction.
//           That is deliberate: this rule is about a contract someone
//           wrote, not about every value that happens to be broad.
//
// Applies:  All .ts and .tsx files EXCEPT:
//           - Test files and scripts
//
// Error:    "This function hands `unknown` to every caller, and each
//            one will invent its own narrowing. Parse the value here,
//            where its origin is known, and return a named type."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. What counts as a wrapper — `PROMISE_TYPE_NAMES` in
//    `../lib/type-annotations.ts`:
//    `Promise` and `PromiseLike` are unwrapped there, along with arrays
//    and `readonly`. A project with its own result container
//    (`Result<T, E>`, `Option<T>`) adds it in that module so this rule
//    and `types/no-broad-parameters` inherit the same reading.
//
// 2. Boundary parsers need a home:
//    A function that genuinely returns unparsed data — a raw transport
//    read — is the one honest case. Give it a directory and exempt the
//    directory here, rather than letting the exemption spread as
//    inline disables. An exemption that names a path stays greppable;
//    a scattered disable comment does not.
//
// 3. This rule reads annotations, not inference:
//    `function f() { return JSON.parse(s) }` returns `any` and is not
//    reported, because nothing was declared. Catching that needs a type
//    checker and belongs in `tsc`, not in this tier — a per-file lint
//    rule that pretends otherwise is the kind that goes quietly wrong.
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-unknown-returns": noUnknownReturnsRule }`) and turn
//    it on in `.oxlintrc.json`
//    (`"<plugin>/no-unknown-returns": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import {
  collectLocalTypeAliases,
  FUNCTION_SIGNATURE_NODES,
  lexicalTypeParameterNames,
  resolvesToBroadType,
} from "../lib/type-annotations.ts";

type SignatureNode = ESTree.Node & { returnType?: ESTree.TSTypeAnnotation | null };

const BROAD_RETURN_KEYWORDS = new Set(["TSUnknownKeyword", "TSAnyKeyword"]);

export const noUnknownReturnsRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      unknownReturn:
        "This function hands `unknown` to every caller, and each one will invent its own narrowing. Parse the value here, where its origin is known, and return a named type.",
    },
  },
  create(context) {
    if (isArchitectureExemptPath(context.filename)) return {};

    let aliases: ReadonlyMap<string, ESTree.TSType> = new Map();

    const checkReturnType = (node: SignatureNode) => {
      const annotation = node.returnType;
      if (annotation === null || annotation === undefined) return;
      const shadowed = lexicalTypeParameterNames(node, context.sourceCode.visitorKeys);
      if (!resolvesToBroadType(annotation.typeAnnotation, BROAD_RETURN_KEYWORDS, aliases, shadowed)) {
        return;
      }
      context.report({ node: annotation.typeAnnotation, messageId: "unknownReturn" });
    };

    return {
      Program(node) {
        aliases = collectLocalTypeAliases(node);
      },
      ...Object.fromEntries(FUNCTION_SIGNATURE_NODES.map((kind) => [kind, checkReturnType])),
    };
  },
});
