// ─── types/no-opaque-record ──────────────────────────────────────────
//
// Makes sure: No type is an open dictionary with an `unknown`, `any` or
// `object` value. That holds for `Record<string, unknown>`, an index signature,
// a mapped type with an open key domain, a union that collapses to `unknown`,
// and any alias to one of them. So a misspelled key is a compile error and not
// `undefined` at run time, and a field rename reports at each read.
//
// `any` sits beside `unknown` in the opaque-value set. A ban on `unknown` alone
// teaches an agent to write `any` on the retry, which is the weaker type.
//
// WHICH open key domain it is, is not read. `Record<number, unknown>`,
// `Record<PropertyKey, unknown>` and `Record<any, unknown>` hold the same values
// as the string-keyed one. Whether the domain is open AT ALL is the entire test,
// and it is not a test this check performs: TypeScript models an open key domain
// as an index signature and a closed one as properties, so `indexSignatures`
// returning anything IS openness. `type-shapes.ts` carries the table that
// establishes it. A closed domain names a shape — `{ [K in keyof T]: unknown }`
// is a dirty-field tracker, and so is `Record<keyof T, unknown>`.
//
// NEGATIVE SPACE:
//   - `Record<'draft' | 'paid', unknown>` is silent. Its keys are closed, so a
//     misspelling is already a compile error — but its reads still need casts,
//     and NO rule in this catalog covers opaque values under a closed key domain.
//   - `Record<keyof T & string, unknown>` is silent: an intersection is closed
//     once any member is, and `keyof T` closes it. The price is that `keyof` of a
//     type that is ITSELF a bag stays silent.
//   - An UNINSTANTIATED GENERIC mapped type is silent — `type Loosened<T> = {
//     [K in keyof T as string]: unknown }` has no index signature until `T` is
//     supplied. This is the one case the syntactic predecessor caught and this
//     does not; `type-shapes.ts` states it once for every check that shares the
//     predicate.
//   - A bag REACHED THROUGH a name declared in this tree reports at the
//     declaration and nowhere else. `type Bag = Record<string, unknown>; type
//     Payload = Bag;` is one finding, not two. A bag imported from a package is
//     the mirror case and reports at each use, because there is no declaration in
//     this tree to report at.
//
// A schema or serialization layer that needs the open bag takes the recovery the
// second bullet allows — a CLOSED key domain — or, where the keys are unknown
// until run time, names the value type. No directory silences this check, and the
// vocabulary names none for it.
//
// SCOPE: this is a TREE-SCOPED check. It walks the declared trees and the
// type-carrying files inside them, minus what `isArchitectureExemptSourcePath`
// names — tests, scripts, generated and ambient modules. Neither silence is
// coverage. It is also silent on any file its tree's tsconfig does not compile,
// which `assertTreeIsTypeChecked` turns into a loud failure rather than a quiet
// zero.
// ──────────────────────────────────────────────────────────────────────

import type { Finding, StructuralCheck, TreeContext } from "../check-substrate.ts";
import { SyntaxKind, type Node, type SourceFile, type Type } from "../type-checker.ts";
import { findingAtNode, isOpaqueDictionary, typeCheckableNodesOfKind, treeSourceFiles } from "./type-shapes.ts";

const OPAQUE_RECORD_MESSAGE =
  "Record<string, unknown> is an untyped bag: every read needs a cast and no key is checked. " +
  "Declare the fields as a named type or interface, use Map<string, T> for open-ended runtime keys, " +
  "or parse external input with a schema that returns a typed shape.";

const OPAQUE_INDEX_SIGNATURE_MESSAGE =
  "An index signature with an unknown/any value is Record<string, unknown> spelled differently — " +
  "the same untyped bag. Declare the fields as a named type or interface, use Map<string, T> for " +
  "open-ended runtime keys, or parse external input with a schema that returns a typed shape.";

/**
 * The four places a bag can be WRITTEN.
 *
 * `TypeReference` covers `Record<…>` and every alias to one; `TypeLiteral` covers
 * the inline `{ [k: string]: unknown }`; `MappedType` covers `{ [K in string]:
 * unknown }`; `InterfaceDeclaration` covers the same index signature given a
 * name, which no type-position walk reaches because an interface is a statement.
 *
 * Not `IndexSignature` itself, and that is the change the checker makes possible:
 * the syntactic predecessor matched the signature node because it could not ask
 * what the enclosing type was. Matching the enclosing type instead is what makes
 * `Partial<Record<string, unknown>>` one finding at the outermost spelling
 * rather than none.
 */
const BAG_SITE_KINDS: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.TypeReference,
  SyntaxKind.TypeLiteral,
  SyntaxKind.MappedType,
  SyntaxKind.InterfaceDeclaration,
]);

export const noOpaqueRecordCheck: StructuralCheck = {
  id: "types/no-opaque-record",
  scope: "tree",

  async run(context: TreeContext): Promise<Finding[]> {
    const treeChecker = await context.typeChecker();
    const findings: Finding[] = [];

    for (const file of await treeSourceFiles(context, treeChecker)) {
      const sites = typeCheckableNodesOfKind(file, BAG_SITE_KINDS);
      if (sites.length === 0) continue;

      // Two batches, because an interface's type is not the type "at" its
      // declaration node — `getTypeAtLocation` on an `InterfaceDeclaration`
      // answers about the statement, not the shape it declares. Asking through
      // the symbol is the only reading that works, and it is one request per
      // interface rather than one for the batch.
      const types = await typesOfSites(treeChecker, sites);

      const reported: { pos: number; end: number }[] = [];
      for (const [index, type] of types.entries()) {
        const node = sites[index];
        if (node === undefined || type === undefined) continue;
        if (!(await isOpaqueDictionary(treeChecker, type))) continue;

        // OUTERMOST WINS. `Partial<Record<string, unknown>>` is two nested type
        // references and one bag, written once. Document order puts the
        // enclosing node first, so a site inside one already reported is the
        // same bag seen again.
        if (reported.some((seen) => seen.pos <= node.pos && node.end <= seen.end)) continue;

        // A reference to a name this tree DECLARES is not the site — its
        // declaration is, and that declaration is walked too. This is the
        // distinction the syntactic rule could not draw at all: it matched the
        // literal identifier `Record` and never resolved a name, so an alias
        // chain reported nowhere and a direct `Record` reported everywhere.
        if (node.kind === SyntaxKind.TypeReference && (await treeChecker.declaredInProgram(node))) {
          continue;
        }

        reported.push({ pos: node.pos, end: node.end });
        findings.push(
          findingAtNode(
            context,
            file,
            node,
            "error",
            node.kind === SyntaxKind.TypeReference
              ? OPAQUE_RECORD_MESSAGE
              : OPAQUE_INDEX_SIGNATURE_MESSAGE,
          ),
        );
      }
    }

    return findings;
  },
};

/** The type each site denotes, in the order the sites were found. */
async function typesOfSites(
  treeChecker: Awaited<ReturnType<TreeContext["typeChecker"]>>,
  sites: readonly Node[],
): Promise<(Type | undefined)[]> {
  const inline = sites.filter((node) => node.kind !== SyntaxKind.InterfaceDeclaration);
  const inlineTypes =
    inline.length > 0 ? await treeChecker.checker.getTypeAtLocation(inline) : [];

  const types: (Type | undefined)[] = [];
  let next = 0;
  for (const node of sites) {
    if (node.kind !== SyntaxKind.InterfaceDeclaration) {
      types.push(inlineTypes[next++]);
      continue;
    }
    const named = node as Node & { name?: Node };
    const symbol = named.name ? await treeChecker.checker.getSymbolAtLocation(named.name) : undefined;
    types.push(symbol ? await treeChecker.checker.getDeclaredTypeOfSymbol(symbol) : undefined);
  }
  return types;
}
