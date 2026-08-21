// ─── Shared reading for the `types/` checks ───────────────────────────
//
// Everything the seven type-aware checks ask that more than one of them asks.
// This is the structural tier's replacement for the oxlint tier's 736-line
// `lib/type-annotations.ts`, and the size difference is the whole argument for
// the move: that module spent ~340 lines deciding "is this key domain open" and
// "does this alias resolve to something broad" by walking syntax and enumerating
// the spellings it knew. Both questions are one call here, because the compiler
// has already answered them. What was left of that file after the move is 54
// lines under the name `lib/parameter-shapes.ts`, which is what it always was.
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
 * The value types of `type`'s index signatures, or `undefined` when its key
 * domain is CLOSED.
 *
 * The single owner of "is this key domain open", which is the question ea-66
 * spent four review rounds and ~340 lines of syntax walking on. Here it is the
 * presence of an index signature, and the two callers below split on what they
 * do with the answer — which is exactly where the three ported checks are meant
 * to diverge and nowhere else.
 *
 * The `Object` flag gate is not an optimisation. A primitive has index infos too
 * (`string` is indexable by number), and without the gate every `string`
 * annotation in the tree is a bag.
 */
export async function openKeyDomainValueTypes(
  treeChecker: TreeTypeChecker,
  type: Type,
): Promise<readonly Type[] | undefined> {
  if (type.isErrorType()) return undefined;
  if ((type.flags & TypeFlags.Object) === 0) return undefined;
  const infos = await treeChecker.indexSignatures(type);
  if (infos.length === 0) return undefined;
  return infos.map((info) => info.valueType);
}

/**
 * Whether `type` is an open dictionary whose values say nothing — the whole of
 * `types/no-opaque-record`'s question.
 *
 * The KEY half comes from `openKeyDomainValueTypes` and the VALUE half is added
 * here. `types/no-known-value-widening` deliberately stops at the key half, so
 * `Record<string, Handler>` reports there and is silent here: a dictionary with
 * a precise value type is evidence of a known type, not an untyped bag.
 */
export async function isOpaqueDictionary(
  treeChecker: TreeTypeChecker,
  type: Type,
): Promise<boolean> {
  const values = await openKeyDomainValueTypes(treeChecker, type);
  if (values === undefined) return false;
  const opaque = UNTYPED_TYPE_FLAGS | NON_PRIMITIVE_TYPE_FLAGS;
  for (const value of values) {
    if (await typeResolvesToFlags(treeChecker, value, opaque)) return true;
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
 * produce a wrong answer — it KILLS THE RUN. See `isTypeRequestUnsafe`.
 */
export function typeCheckableNodesOfKind(
  file: SourceFile,
  kinds: ReadonlySet<SyntaxKind>,
): Node[] {
  const found: Node[] = [];
  const walk = (node: Node): void => {
    if (kinds.has(node.kind) && !isTypeRequestUnsafe(node)) found.push(node);
    node.forEachChild(walk);
  };
  walk(file);
  return found;
}

/**
 * The nodes that must never be handed to `getTypeAtLocation`, because asking
 * KILLS THE SERVER.
 *
 * On TypeScript 7.0.2 the response encoder panics on the EMPTY TUPLE type —
 * `interface conversion: checker.TypeData is *checker.TypeReference, not
 * *checker.TupleType` — and the process takes every remaining check in the run
 * with it. Probed to find the exact trigger rather than guessed at, because a
 * blanket try/catch around every request would turn a crash into silence, which
 * is the failure this catalog exists to prevent:
 *
 *   PANICS    `[]`                    (an empty array literal)
 *             `[] as const`           (the assertion over one)
 *             the `const` in it       (parsed as a type reference named `const`)
 *   FINE      `[1] as const`, `{ a: 1 } as const`, `const x: [] = []`'s
 *             ANNOTATION, a reference to `type Empty = []`, and an identifier
 *             whose type is an empty tuple
 *
 * So the unsafe set is closed and syntactic: the literal, the assertion wrapped
 * directly around it, and the `const` marker. Nothing that merely RESOLVES to an
 * empty tuple is affected, which is why one structural test covers every check
 * in this tag rather than each one needing its own guard.
 *
 * The `const` marker is worth skipping on its own merits too: `const` is a
 * reserved word and cannot name a type, so a type reference spelled `const` is
 * always this marker and never a subject.
 */
export function isTypeRequestUnsafe(node: Node): boolean {
  if (node.kind === SyntaxKind.TypeReference) {
    const reference = node as Node & { typeName?: { text?: string } };
    return reference.typeName?.text === "const";
  }
  if (isEmptyArrayLiteral(node)) return true;
  if (node.kind === SyntaxKind.AsExpression || node.kind === SyntaxKind.TypeAssertionExpression) {
    const assertion = node as Node & { expression?: Node };
    return assertion.expression !== undefined && isEmptyArrayLiteral(assertion.expression);
  }
  return false;
}

function isEmptyArrayLiteral(node: Node): boolean {
  if (node.kind !== SyntaxKind.ArrayLiteralExpression) return false;
  const literal = node as Node & { elements?: readonly Node[] };
  return (literal.elements?.length ?? 0) === 0;
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

/**
 * Every node that declares a call signature, which is what "a function" means
 * once type positions count.
 *
 * Spelled once for the whole tag because the three checks that read signatures
 * — parameters, return types, and the guard exemption both of them share — must
 * agree on the set. The oxlint tier's predecessor kept the same list under
 * `FUNCTION_SIGNATURE_NODES` for the same reason: a check that forgets
 * `MethodSignature` is silent on every interface in the tree and reads as clean.
 */
export const FUNCTION_LIKE_KINDS: ReadonlySet<SyntaxKind> = new Set([
  SyntaxKind.ArrowFunction,
  SyntaxKind.CallSignature,
  SyntaxKind.ConstructSignature,
  SyntaxKind.Constructor,
  SyntaxKind.ConstructorType,
  SyntaxKind.FunctionDeclaration,
  SyntaxKind.FunctionExpression,
  SyntaxKind.FunctionType,
  SyntaxKind.GetAccessor,
  SyntaxKind.MethodDeclaration,
  SyntaxKind.MethodSignature,
  SyntaxKind.SetAccessor,
]);

/**
 * The nearest enclosing function, or `undefined` at the top level.
 *
 * Stops at the FIRST one, and that is the contract two checks depend on: a
 * callback nested inside a type guard has its own signature and its own (absent)
 * predicate, so the outer guard's promise does not reach into it.
 */
export function enclosingFunctionLike(node: Node): Node | undefined {
  let current: Node | undefined = node.parent;
  while (current !== undefined && current.kind !== SyntaxKind.SourceFile) {
    if (FUNCTION_LIKE_KINDS.has(current.kind)) return current;
    current = current.parent;
  }
  return undefined;
}

/**
 * The parameter names a function's own declarations vouch for with a type
 * predicate — `value is InvoiceId`, `asserts value is InvoiceId`.
 *
 * Reads EVERY declaration of the function's symbol, not just this node's return
 * type, because an overloaded guard declares its predicate on the overload
 * signatures and widens the implementation's return type to `boolean`. Asking
 * the checker which declarations belong together is the part the syntactic
 * predecessor had to reconstruct by hand.
 *
 * A predicate over `this` vouches for the receiver, which is not a parameter, so
 * it contributes no name and exempts nothing.
 */
export async function typePredicateSubjects(
  treeChecker: TreeTypeChecker,
  fn: Node,
): Promise<ReadonlySet<string>> {
  const subjects = new Set<string>();
  const named = fn as Node & { name?: Node };

  const declarations: Node[] = [fn];
  if (named.name !== undefined) {
    const symbol = await treeChecker.checker.getSymbolAtLocation(named.name);
    for (const handle of symbol?.declarations ?? []) {
      const other = await handle.resolve();
      if (other !== undefined) declarations.push(other);
    }
  }

  for (const declaration of declarations) {
    const returnType = (declaration as Node & { type?: Node }).type;
    if (returnType?.kind !== SyntaxKind.TypePredicate) continue;
    const predicate = returnType as Node & { parameterName?: Node & { text?: string } };
    const name = predicate.parameterName?.text;
    if (name !== undefined && name !== "this") subjects.add(name);
  }

  return subjects;
}
