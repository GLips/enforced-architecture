// ─── types/no-unknown-returns ────────────────────────────────────────
//
// Makes sure: Every declared return type names what the function produces.
// `unknown`, `any`, `Promise<unknown>`, `unknown[]` and any alias to one of them
// are not contracts. So a caller reads a field off the result with no narrowing
// of its own, and one change to the returned type reports at each call site.
//
// The check reads the DECLARED annotation only. A function with no return type
// keeps TypeScript's inference, which is precise, and `function f() { return
// JSON.parse(s) }` is `tsc`'s complaint rather than this one — the shipped
// `typescript/no-unsafe-return` is the rule for a returned `any` VALUE, and it is
// deliberately a different subject. See the `types` section of the shipped
// `oxlintrc.json`.
//
// A function that returns unparsed transport data is the one honest case. Parse
// at that boundary and return a named type, which is what the message asks for.
// No directory silences this check, and the vocabulary names none for it.
//
// `Promise`, `PromiseLike` and arrays are unwrapped by
// `TRANSPARENT_CONTAINER_NAMES` in `type-shapes.ts`. A project with its own
// container (`Result<T, E>`, `Option<T>`) adds it there, so this check and
// `types/no-broad-parameters` read a signature alike.
//
// NEGATIVE SPACE:
//   - There is NO per-line escape. This tier has no `eslint-disable` and none is
//     planned, so the one honest case above has to take the recovery the message
//     names rather than a comment. The oxlint-tier predecessor could be silenced
//     a line at a time; the move took that away, deliberately.
//   - A GENERIC return type is silent even when every call site instantiates it
//     broadly. `function load<T>(): T` returns a type parameter, not `unknown`,
//     and the widening happens at `load<unknown>()` — which this check does not
//     read, because its subject is the declaration.
//
// SCOPE: this is a TREE-SCOPED check. It walks the declared trees and the
// type-carrying files inside them, minus what `isArchitectureExemptSourcePath`
// names — tests, scripts, generated and ambient modules. Neither silence is
// coverage. It is also silent on any file its tree's tsconfig does not compile,
// which `assertTreeIsTypeChecked` turns into a loud failure rather than a quiet
// zero.
// ──────────────────────────────────────────────────────────────────────

import type { Finding, StructuralCheck, TreeContext } from "../check-context.ts";
import type { Node } from "../type-checker.ts";
import {
  findingAtNode,
  FUNCTION_LIKE_KINDS,
  treeSourceFiles,
  typeCheckableNodesOfKind,
  typeResolvesToFlags,
  UNTYPED_TYPE_FLAGS,
} from "./type-shapes.ts";

const UNKNOWN_RETURN_MESSAGE =
  "This function hands `unknown` to every caller, and each one will invent its own narrowing. " +
  "Parse the value here, where its origin is known, and return a named type.";

export const noUnknownReturnsCheck: StructuralCheck = {
  id: "types/no-unknown-returns",
  scope: "tree",

  async run(context: TreeContext): Promise<Finding[]> {
    const treeChecker = await context.typeChecker();
    const findings: Finding[] = [];

    for (const file of await treeSourceFiles(context, treeChecker)) {
      const annotations: Node[] = [];
      for (const fn of typeCheckableNodesOfKind(file, FUNCTION_LIKE_KINDS)) {
        const returnType = (fn as Node & { type?: Node }).type;
        if (returnType !== undefined) annotations.push(returnType);
      }
      if (annotations.length === 0) continue;

      const types = await treeChecker.checker.getTypeAtLocation(annotations);
      for (const [index, type] of types.entries()) {
        const node = annotations[index];
        if (node === undefined || type === undefined) continue;
        if (!(await typeResolvesToFlags(treeChecker, type, UNTYPED_TYPE_FLAGS))) continue;
        findings.push(findingAtNode(context, file, node, "error", UNKNOWN_RETURN_MESSAGE));
      }
    }

    return findings;
  },
};
