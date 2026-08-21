// ─── types/no-unknown-type-aliases ───────────────────────────────────
//
// Makes sure: No type name resolves to `unknown` or `any`, through any depth of
// alias. A name in a signature states a contract, so you never follow
// `ApiPayload` through two files to learn that it decides nothing. It also
// closes the one-line alias that hides a broad type from the parameter check and
// the return check.
//
// A generic alias is judged like any other, and there is no exemption for one.
// `type Boxed<T> = T` is silent because `T` resolves to a type PARAMETER and a
// parameter is not `unknown` — the compiler's answer, not a special case. An
// early-out on `typeParameters` was written here first and then deleted: it
// changed no fixture's verdict, and the one alias it would have changed —
// `type Boxed<T> = unknown`, which ignores its parameter and promises nothing —
// is a defect this check should report and did not.
//
// The overlap with `types/no-broad-parameters` and `types/no-unknown-returns` is
// deliberate: one file can report here AND at each use. That is not double
// counting. The alias is one defect and each use is another, and one edit to the
// alias clears them all.
//
// Neither DEPTH nor LOCATION bounds it. An alias declared inside a function or a
// namespace is an alias, an alias to an imported name resolves through the
// import, and a chain resolves to its end — resolution is the compiler's job and
// nothing here re-implements a shorter version of it.
//
// NEGATIVE SPACE:
//   - An alias to a broad type from a DEPENDENCY reports here, at the local
//     alias, and never at the dependency. Nothing in this catalog reads
//     `node_modules`.
//
// SCOPE: this is a TREE-SCOPED check. It walks the declared trees and the
// type-carrying files inside them, minus what `isArchitectureExemptSourcePath`
// names — tests, scripts, generated and ambient modules. Neither silence is
// coverage. It is also silent on any file its tree's tsconfig does not compile,
// which `assertTreeIsTypeChecked` turns into a loud failure rather than a quiet
// zero.
// ──────────────────────────────────────────────────────────────────────

import type { Finding, StructuralCheck, TreeContext } from "../check-substrate.ts";
import { SyntaxKind, type Node } from "../type-checker.ts";
import {
  findingAtNode,
  treeSourceFiles,
  typeCheckableNodesOfKind,
  typeResolvesToFlags,
  UNTYPED_TYPE_FLAGS,
} from "./type-shapes.ts";

const ALIAS_KINDS: ReadonlySet<SyntaxKind> = new Set([SyntaxKind.TypeAliasDeclaration]);

export const noUnknownTypeAliasesCheck: StructuralCheck = {
  id: "types/no-unknown-type-aliases",
  scope: "tree",

  async run(context: TreeContext): Promise<Finding[]> {
    const treeChecker = await context.typeChecker();
    const findings: Finding[] = [];

    for (const file of await treeSourceFiles(context, treeChecker)) {
      for (const node of typeCheckableNodesOfKind(file, ALIAS_KINDS)) {
        const alias = node as Node & { name?: Node & { text?: string } };
        if (alias.name === undefined) continue;

        const symbol = await treeChecker.checker.getSymbolAtLocation(alias.name);
        if (symbol === undefined) continue;
        const declared = await treeChecker.checker.getDeclaredTypeOfSymbol(symbol);
        if (!(await typeResolvesToFlags(treeChecker, declared, UNTYPED_TYPE_FLAGS))) continue;

        findings.push(
          findingAtNode(
            context,
            file,
            alias.name,
            "error",
            `Type alias \`${alias.name.text ?? "?"}\` names a contract and then declines to state ` +
              `one — it resolves to \`unknown\`. Keep \`unknown\` visible at the parse boundary ` +
              `where it is honest, and give this name the parsed type instead.`,
          ),
        );
      }
    }

    return findings;
  },
};
