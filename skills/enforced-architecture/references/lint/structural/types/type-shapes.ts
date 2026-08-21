// ─── Shared reading for the `types/` checks ───────────────────────────
//
// Everything the seven type-aware checks ask that more than one of them asks.
// Two questions carry the file — "is this key domain open" and "does this
// resolve to something broad" — and each is one call to the checker, which is
// the whole reason these checks live in this tier. `structural/types/overview.md`
// has the comparison against the syntactic tier that used to answer them.
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
// Nothing above is enumerated anywhere in this file. The wrapped forms
// (`Partial<Record<…>>`, `Readonly<Record<…>>`) and the closed ones (an enum, a
// `keyof`, a `(typeof KEYS)[number]`) land on the right side without being named,
// which is why there is no spelling here to have missed.
//
// ── Negative space ────────────────────────────────────────────────────
//
// - An UNINSTANTIATED GENERIC is invisible to the index-signature question.
//   `type Loosened<T> = { [K in keyof T as string]: unknown }` has no index info
//   until `T` is supplied, because the key domain is not resolved until then.
//   Each INSTANTIATION is judged on its own, and the alias is silent. It is
//   stated here rather than in one check's header because the predicate is
//   shared, so the blind spot is.
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
 *
 * It is a COVERAGE list, though, and that cuts the other way from the rest of
 * this catalog's vocabulary knobs: shortening it does not rename anything, it
 * makes `Promise<unknown>` legal. The four names here are the ones the language
 * ships, and a project that removes one has turned a check off in a costume — the
 * shape the posture doc warns about, arriving through a list rather than a regex.
 * `bp-spellings.ts` pins all four, so a deletion fails the suite rather than
 * going quiet.
 *
 * Matched by the SYMBOL's name, not the alias's. `type Awaitable<T> =
 * PromiseLike<T>` unwraps; a project's own `Result` does not until it is added.
 */
const TRANSPARENT_CONTAINER_NAMES = new Set([
  "Array",
  "ReadonlyArray",
  "Promise",
  "PromiseLike",
]);

/**
 * Whether `type` is, or transparently contains, a type with any of `flags`.
 *
 * "Transparently contains" is two things and no more: a UNION is matched when
 * ANY member matches — `object | string` still forces a cast to read — and a
 * container from `TRANSPARENT_CONTAINER_NAMES` is matched when its element does.
 *
 * `seen` is a CYCLE guard and not a depth budget, because the cycle is real:
 * `type Nested = Promise<Nested[]>` is a legal alias the compiler accepts, and
 * unwrapping it alternates `Promise` and `Array` forever. A depth bound
 * terminates that too — and silently answers "not broad" for the fifth `Promise`
 * in an honest nest, which is a hole with a number on it. Type ids are stable
 * within a program, so revisiting one can only produce the answer already given.
 *
 * The ERROR type answers false whatever its flags say. It carries `Any`, so
 * without this line every unresolved import turns into a finding blaming the
 * author for a broad annotation they did not write.
 */
export async function typeResolvesToFlags(
  treeChecker: TreeTypeChecker,
  type: Type,
  flags: number,
  seen: Set<number> = new Set(),
): Promise<boolean> {
  if (type.isErrorType()) return false;
  if ((type.flags & flags) !== 0) return true;
  if (seen.has(type.id)) return false;
  seen.add(type.id);

  if (type.isUnionType()) {
    for (const member of await type.getTypes()) {
      if (await typeResolvesToFlags(treeChecker, member, flags, seen)) return true;
    }
    return false;
  }

  if (type.isTypeReference()) {
    const name = (await type.getSymbol())?.name;
    if (name !== undefined && TRANSPARENT_CONTAINER_NAMES.has(name)) {
      for (const argument of await treeChecker.checker.getTypeArguments(type)) {
        if (await typeResolvesToFlags(treeChecker, argument, flags, seen)) return true;
      }
    }
  }

  return false;
}

/**
 * The value types of `type`'s index signatures, or `undefined` when its key
 * domain is CLOSED.
 *
 * The single owner of "is this key domain open". The answer is the presence of
 * an index signature, and the two callers below split on what they do with it —
 * which is exactly where the three checks that ask are meant to diverge, and
 * nowhere else.
 *
 * The `Object` flag gate is not an optimisation. A primitive has index infos too
 * (`string` is indexable by number), and without the gate every `string`
 * annotation in the tree is a bag.
 *
 * An ARRAY-LIKE is excluded for the same reason and it is not a special case:
 * `unknown[]` carries a number index signature, so by the flag test alone every
 * array in the tree is an open dictionary, and both callers would tell its author
 * to declare the fields or reach for a `Map`. An array's open numeric domain is
 * what an array IS. The broadness of its ELEMENT is a different check's finding —
 * `typeResolvesToFlags` unwraps `Array` for exactly that — and the two answers
 * must not both arrive at one annotation.
 */
export async function openKeyDomainValueTypes(
  treeChecker: TreeTypeChecker,
  type: Type,
): Promise<readonly Type[] | undefined> {
  // The error type is caught by the Object gate below, not by a line of its own:
  // an unresolved name carries `Any`, never `Object`.
  if ((type.flags & TypeFlags.Object) === 0) return undefined;
  const infos = await treeChecker.indexSignatures(type);
  if (infos.length === 0) return undefined;
  // Asked LAST, and only of a type that already carries an index signature. It is
  // a round trip, and the population that reaches it is the bags plus the arrays
  // rather than every type in the tree.
  if (await treeChecker.checker.isArrayLikeType(type)) return undefined;
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
 * The one node that must never be handed to `getTypeAtLocation`: the `const` in
 * `as const`, which parses as a type reference named `const`.
 *
 * Asking about it on TypeScript 7.0.2 panics the response encoder —
 * `interface conversion: checker.TypeData is *checker.TypeReference, not
 * *checker.TupleType`. The panic arrives as a REJECTED REQUEST rather than a
 * dead process, which is not a reprieve: `attempt()` in
 * `run-structural-checks.ts` turns it into a crashed check, and
 * `no-opaque-record` collects type references, so without this line the whole
 * tag goes red on any file spelling `as const`.
 *
 * `const` is a reserved word and cannot name a type, so a type reference spelled
 * `const` is always this marker and never a subject. That is the whole predicate
 * — no try/catch, which would turn a crash into silence, and no list.
 *
 * NARROW ON PURPOSE, and `empty-tuple-probe.ts` in the fixture tree is what says
 * so. `[]`, `[1] as const`, `const x: [] = []`'s annotation, a reference to
 * `type Empty = []`, and an identifier of empty-tuple type all answer fine. An
 * earlier cut of this function skipped the empty array literal too, on a panic
 * it does not cause; all that skip did was hide a real widening.
 */
export function isTypeRequestUnsafe(node: Node): boolean {
  if (node.kind !== SyntaxKind.TypeReference) return false;
  const reference = node as Node & { typeName?: { text?: string } };
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

/**
 * Every node that declares a call signature, which is what "a function" means
 * once type positions count.
 *
 * Spelled once for the whole tag because the three checks that read signatures
 * — parameters, return types, and the guard exemption both of them share — must
 * agree on the set. A check that forgets `MethodSignature` is silent on every
 * interface in the tree and reads as clean, which is the failure this list
 * exists to make impossible to have privately.
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
 * signatures and widens the implementation's return type to `boolean`. Which
 * declarations belong together is the checker's answer, not a name match.
 *
 * `this` is in the set when a predicate names it, and that costs nothing: no
 * PARAMETER is ever called `this` at the point this set is consulted, because
 * `types/no-broad-parameters` drops the receiver before it looks. Filtering here
 * instead was a line no fixture could reach.
 */
export async function typePredicateSubjects(
  treeChecker: TreeTypeChecker,
  fn: Node,
): Promise<ReadonlySet<string>> {
  return new Set(await predicateSubjectNames(treeChecker, fn));
}

/**
 * Whether `fn` is a type guard at all, over a parameter or over its receiver.
 *
 * Separate from `typePredicateSubjects` because the two questions have different
 * answers on the same function and each check needs only one of them.
 * `types/no-broad-parameters` asks WHICH NAMES are vouched for, and `this` is not
 * a name it can exempt; `types/no-runtime-typeof` asks whether the enclosing
 * function publishes a narrowing contract, and `this is Ledger` publishes one.
 *
 * Reading a non-empty subject set as "is a guard" collapses them, and the
 * collapse is silent in the direction that matters: a guard whose only predicate
 * is over `this` reports the `typeof` that IS its parse step, with no signature
 * the author can write to satisfy both checks.
 */
export async function declaresTypePredicate(
  treeChecker: TreeTypeChecker,
  fn: Node,
): Promise<boolean> {
  return (await predicateSubjectNames(treeChecker, fn)).length > 0;
}

/**
 * Every name a predicate on `fn` vouches for, `this` included, across EVERY
 * declaration of its symbol.
 *
 * The overload case is why it resolves the symbol rather than reading this node:
 * an overloaded guard declares `value is T` on the signature and widens the
 * implementation's return to `boolean`, so a reader of one node sees no
 * predicate on the declaration that has the body.
 */
async function predicateSubjectNames(treeChecker: TreeTypeChecker, fn: Node): Promise<string[]> {
  const names: string[] = [];
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
    // `value is T` carries an Identifier; `this is T` carries a `ThisType` node,
    // which has no `text`. Reading only `text` answers "not a guard" for every
    // receiver predicate, and the function whose `typeof this` IS the parse step
    // then reports with no signature its author could write instead.
    const predicate = returnType as Node & { parameterName?: Node & { text?: string } };
    if (predicate.parameterName?.kind === SyntaxKind.ThisType) {
      names.push("this");
      continue;
    }
    const name = predicate.parameterName?.text;
    if (name !== undefined) names.push(name);
  }

  return names;
}
