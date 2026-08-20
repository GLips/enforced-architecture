// ─── types/no-unknown-returns ────────────────────────────────────────
//
// Makes sure: Every declared return type names what the function produces.
// `unknown`, `any`, `Promise<unknown>`, `unknown[]` and local aliases to them
// are not contracts. So a caller reads a field off the result with no narrowing
// of its own, and one change to the returned type reports at each call site.
//
// The rule reads the DECLARED annotation only. A function with no return type
// keeps TypeScript's inference, which is precise. `function f() { return
// JSON.parse(s) }` returns `any` and is not reported: to catch that you need a
// type checker, and that work belongs to `tsc`.
//
// A function that returns unparsed transport data is the one honest case. Give
// those functions a directory and exempt the directory here. An exemption that
// names a path stays greppable; scattered disable comments do not.
//
// `Promise`, `PromiseLike`, arrays and `readonly` are unwrapped in
// `../lib/type-annotations.ts`. A project with its own container
// (`Result<T, E>`, `Option<T>`) adds it there, so this rule and
// `types/no-broad-parameters` read a signature alike.
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
  resolvesToBroadType,
} from "../lib/type-annotations.ts";

type SignatureNode = ESTree.Node & { returnType?: ESTree.TSTypeAnnotation | null };

const BROAD_RETURN_KEYWORDS = new Set(["TSUnknownKeyword", "TSAnyKeyword"]);

export const noUnknownReturnsRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      unknownReturn:
        "This function hands `unknown` to every caller, and each one will invent its own narrowing. Parse the value here, where its origin is known, and return a named type.",
    },
  },
  create(context) {

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
