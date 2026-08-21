// ─── Shared reading for the `types/` checks ───────────────────────────
//
// Everything the seven type-aware checks ask that more than one of them asks.
// This is the structural tier's replacement for the oxlint tier's
// `lib/type-annotations.ts`, and the size difference is the whole argument for
// the move: that module spent ~340 lines deciding "is this key domain open" and
// "does this alias resolve to something broad" by walking syntax and enumerating
// the spellings it knew. Both questions are one call here, because the compiler
// has already answered them.
//
// ── The one finding this file is built on ─────────────────────────────
//
// TypeScript gives a type an INDEX SIGNATURE exactly when its key domain is
// open, and PROPERTIES when it is closed. Every spelling lands on the right side
// of that line without being enumerated:
//
//   Record<string, unknown>              → 1 index info
//   { [k: string]: unknown }             → 1 index info
//   { [K in string]: unknown }           → 1 index info
//   Record<PropertyKey, unknown>         → 3 index infos (string, number, symbol)
//   Record<`user_${string}`, unknown>    → 1 index info
//   Partial<Record<string, unknown>>     → 1 index info
//   ---
//   Record<'draft' | 'paid', unknown>    → 0 index infos, 2 properties
//   Record<Status, unknown>   (an enum)  → 0 index infos, 2 properties
//   Record<(typeof KEYS)[number], …>     → 0 index infos, 2 properties
//   Record<keyof T, unknown>             → 0 index infos, 1 property
//
// The last four are the ones the syntactic rule had to recognise by name, and
// two of the first six — `Partial<Record<…>>` and `Readonly<Record<…>>` — are
// cases it documented as covered by NOTHING.
//
// ── Negative space ────────────────────────────────────────────────────
//
// - An UNINSTANTIATED GENERIC is invisible to the index-signature question.
//   `type Loosened<T> = { [K in keyof T as string]: unknown }` has no index info
//   until `T` is supplied, because the key domain is not resolved until then. The
//   syntactic rule caught this one; the checker does not. It is the single case
//   where the move loses coverage, and it is here rather than in one check's
//   header because the predicate is shared.
// - The ERROR type is never a subject. An unresolved name yields a type carrying
//   the `Any` flag, so a file mid-edit — or one importing a package that is not
//   installed — would otherwise report every broken annotation as a deliberately
//   broad one. `tsc` already has that complaint and states it better.
// - Nothing here reads a VALUE. Every question is about a declaration, which is
//   what keeps this tag disjoint from the shipped `no-unsafe-*` family: those
//   report an `any` value arriving somewhere typed, and these report a
//   declaration that names nothing. See the `types` section of the shipped
//   `oxlintrc.json` for why that gap is not a candidate for either side.
// ──────────────────────────────────────────────────────────────────────

import { TYPESCRIPT_FILE_GLOB } from "../../policy/layout.ts";
import {
  collectTreeFiles,
  toProjectPath,
  type Finding,
  type Severity,
  type TreeContext,
} from "../check-substrate.ts";
import {
  SyntaxKind,
  TypeFlags,
  type Node,
  type SourceFile,
  type TreeTypeChecker,
  type Type,
} from "../type-checker.ts";

/**
 * `unknown` and `any` — the two spellings of "this declaration states no
 * contract".
 *
 * They sit together in every check that reads them, and that is a position
 * rather than a convenience: a rule that bans `unknown` alone teaches an author
 * to write `any` on the retry, which is the weaker of the two.
 */
export const UNTYPED_TYPE_FLAGS = TypeFlags.Any | TypeFlags.Unknown;

/**
 * The bare `object` keyword — every non-primitive, with no property readable
 * without a cast.
 *
 * Separate from `UNTYPED_TYPE_FLAGS` because two checks report it with a
 * different message: `object` is a narrower mistake than `unknown` and the fix
 * is a different sentence.
 */
export const NON_PRIMITIVE_TYPE_FLAGS = TypeFlags.NonPrimitive;

/**
 * The containers a project routinely wraps a payload in, unwrapped before the
 * question is asked, so `Promise<unknown>` and `unknown[]` answer the same as
 * `unknown`.
 *
 * The ONE list the checker does not remove, and the tag's single adaptation
 * point: a project with its own `Result<T, E>` or `Option<T>` adds it here, once,
 * and every check reads signatures the same way afterwards. It is a list of
 * names rather than a predicate for the reason the catalog gives everywhere else
 * — enumerable vocabulary is not an off-switch.
 */
const TRANSPARENT_CONTAINER_NAMES = new Set([
  "Array",
  "ReadonlyArray",
  "Promise",
  "PromiseLike",
]);

/**
 * How deep the union and container walk goes before it gives up.
 *
 * A bound rather than a cycle set, because the shapes that recurse here are
 * finite by construction — `Promise<Promise<unknown[]>>` is three levels and
 * nobody writes four. The compiler already refuses a genuinely circular alias,
 * so the bound is a stack guard rather than a correctness argument.
 */
const MAX_UNWRAP_DEPTH = 4;

/**
 * Whether `type` is, or transparently contains, a type with any of `flags`.
 *
 * "Transparently contains" is two things and no more: a UNION is matched when
 * ANY member matches — `object | string` still forces a cast to read — and a
 * container from `TRANSPARENT_CONTAINER_NAMES` is matched when its element does.
 *
 * The ERROR type answers false whatever its flags say. It carries `Any`, so
 * without this line every unresolved import turns into a finding blaming the
 * author for a broad annotation they did not write.
 */
export async function typeResolvesToFlags(
  treeChecker: TreeTypeChecker,
  type: Type,
  flags: number,
  depth = 0,
): Promise<boolean> {
  if (depth > MAX_UNWRAP_DEPTH) return false;
  if (type.isErrorType()) return false;
  if ((type.flags & flags) !== 0) return true;

  if (type.isUnionType()) {
    for (const member of await type.getTypes()) {
      if (await typeResolvesToFlags(treeChecker, member, flags, depth + 1)) return true;
    }
    return false;
  }

  if (type.isTypeReference()) {
    const name = (await type.getSymbol())?.name;
    if (name !== undefined && TRANSPARENT_CONTAINER_NAMES.has(name)) {
      for (const argument of await treeChecker.checker.getTypeArguments(type)) {
        if (await typeResolvesToFlags(treeChecker, argument, flags, depth + 1)) return true;
      }
    }
  }

  return false;
}

/**
 * Whether `type` is an open dictionary whose values say nothing — the whole of
 * `types/no-opaque-record`'s question, and the reason this module exists.
 *
 * The `Object` flag gate is not an optimisation. A primitive has index infos
 * too (`string` is indexable by number), and without the gate every `string`
 * annotation in the tree is a bag.
 */
export async function isOpaqueDictionary(
  treeChecker: TreeTypeChecker,
  type: Type,
): Promise<boolean> {
  if (type.isErrorType()) return false;
  if ((type.flags & TypeFlags.Object) === 0) return false;
  const opaque = UNTYPED_TYPE_FLAGS | NON_PRIMITIVE_TYPE_FLAGS;
  for (const info of await treeChecker.indexSignatures(type)) {
    if (await typeResolvesToFlags(treeChecker, info.valueType, opaque)) return true;
  }
  return false;
}

/**
 * Every node of one of `kinds`, in document order, that the checker can be ASKED
 * ABOUT — which is every one of them but the `as const` marker.
 *
 * Collected in a single pass and returned as an array so the caller can ask the
 * checker about ALL of them in one request: `getTypeAtLocation` takes a batch,
 * and a call per node is the difference between 8,100 round trips and 16,100 on
 * a 2,000-file tree.
 *
 * The exclusion is here, and not in each check, because forgetting it does not
 * produce a wrong answer — it KILLS THE RUN. See `isConstAssertionMarker`.
 */
export function typeCheckableNodesOfKind(
  file: SourceFile,
  kinds: ReadonlySet<SyntaxKind>,
): Node[] {
  const found: Node[] = [];
  const walk = (node: Node): void => {
    if (kinds.has(node.kind) && !isConstAssertionMarker(node)) found.push(node);
    node.forEachChild(walk);
  };
  walk(file);
  return found;
}

/**
 * The `const` in `x as const`, which the parser records as a type reference to a
 * type named `const`.
 *
 * Two reasons it is skipped, and the second is the urgent one:
 *
 *   1. It denotes no type. `const` is a reserved word and cannot name one, so a
 *      type reference spelled `const` is ALWAYS this marker — a structural fact
 *      about the grammar rather than a name anyone could shadow.
 *   2. Asking the checker about it CRASHES THE SERVER. On TypeScript 7.0.2,
 *      `getTypeAtLocation` over `[] as const` panics inside the response encoder
 *      (`interface conversion: checker.TypeData is *checker.TypeReference, not
 *      *checker.TupleType`) and the process takes the whole run's remaining
 *      checks with it. The trigger is the EMPTY TUPLE type specifically:
 *      `[1] as const` and `{ a: 1 } as const` are fine, `[] as const` and
 *      `const x: [] = []` are not. Type nodes that merely RESOLVE to an empty
 *      tuple — a reference to `type Empty = []` — are also fine, so this one
 *      exclusion covers every type-position ask.
 *
 * NEGATIVE SPACE: a check that asks about an EXPRESSION rather than a type node
 * can still hit the same panic through an empty array literal, and nothing here
 * protects it.
 */
export function isConstAssertionMarker(node: Node): boolean {
  if (node.kind !== SyntaxKind.TypeReference) return false;
  const reference = node as Node & { typeName?: { kind: SyntaxKind; text?: string } };
  return reference.typeName?.text === "const";
}

/**
 * Every file in this tree that the type checker has an answer about, paired with
 * its parsed source.
 *
 * Driven by the TREE's file list rather than the program's, and the direction
 * matters: the program legitimately reaches past the tree — a monorepo tsconfig
 * compiles four packages — and a check that walked the program would report a
 * neighbouring package's files under this tree's name. `assertTreeIsTypeChecked`
 * has already established that the other direction is empty.
 */
export async function treeSourceFiles(
  context: TreeContext,
  treeChecker: TreeTypeChecker,
): Promise<SourceFile[]> {
  const found: SourceFile[] = [];
  for (const absolute of collectTreeFiles(context, TYPESCRIPT_FILE_GLOB)) {
    const file = await treeChecker.program.getSourceFile(absolute);
    if (file !== undefined) found.push(file);
  }
  return found;
}

/**
 * A finding placed at a node, with the line the compiler already knows.
 *
 * The oxlint tier gets line numbers for free from the linter; here the parsed
 * file is the only thing that has them, so every check builds its findings
 * through this rather than re-deriving offsets from the text — two derivations
 * of one line number is two line numbers.
 */
export function findingAtNode(
  context: TreeContext,
  file: SourceFile,
  node: Node,
  severity: Severity,
  message: string,
): Finding {
  const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
  return {
    severity,
    file: toProjectPath(context.config, file.fileName),
    line: line + 1,
    message,
  };
}
