// Shared reading of a function signature: what its parameters are annotated with, what they
// destructure, and whether it is a type guard. Every rule in the `types` tag reads this file, and
// `react/prop-count` reads the parameter half of it.
//
// Every rule in that tag asks a version of the same question — "does this annotation resolve to a
// type that carries no information?" — and each one can be beaten by the same three spellings: a
// union that buries the broad member, a local alias that renames it, and a generic wrapper that
// hides it one level down. Answering that once here is what stops each rule shipping its own
// near-copy, which is exactly how five of this catalog's GritQL rules ended up over-matching in
// subtly different ways.
//
// This file also owns the tag's second shared question — "is this signature a type guard?" — for
// the same reason. Two rules turn on it and they must agree: `no-runtime-typeof` allows a `typeof`
// inside a guard's body, and `no-broad-parameters` allows the untyped value that guard vouches
// for. A guard the two read differently is an edit loop, where satisfying one rule's message
// trips the other.
//
// And the third — "is this type an open dictionary?" — in the section at the foot of the file.
// Three rules ask it and, before that section, three answered it differently.
//
// ── Adapt ──
// `PROMISE_TYPE_NAMES` exists because `Promise<unknown>` is an unknown contract wearing a wrapper;
// add project-specific containers (`Result`, `Option`) whose type argument is the real payload.
// Generic aliases are deliberately NOT resolved through — see `resolvesToBroadType`.

import type { ESTree, SourceCode } from "@oxlint/plugins";
import { staticKeyName } from "./static-key-name.ts";

/** Every node that carries `params` and a `returnType`, including the type-level spellings. */
export const FUNCTION_SIGNATURE_NODES = [
  "ArrowFunctionExpression",
  "FunctionDeclaration",
  "FunctionExpression",
  "TSCallSignatureDeclaration",
  "TSConstructSignatureDeclaration",
  "TSConstructorType",
  "TSDeclareFunction",
  "TSEmptyBodyFunctionExpression",
  "TSFunctionType",
  "TSMethodSignature",
] as const;

/** Any node in `FUNCTION_SIGNATURE_NODES`, narrowed from the full `Node` union. */
export type SignatureNode = Extract<
  ESTree.Node,
  { type: (typeof FUNCTION_SIGNATURE_NODES)[number] }
>;

const SIGNATURE_NODE_TYPES: ReadonlySet<string> = new Set(FUNCTION_SIGNATURE_NODES);

function isSignatureNode(node: ESTree.Node): node is SignatureNode {
  return SIGNATURE_NODE_TYPES.has(node.type);
}

const PROMISE_TYPE_NAMES = new Set(["Promise", "PromiseLike"]);

/**
 * The annotation on a parameter, reached through the wrappers that carry their own.
 *
 * A rule reading `parameter.typeAnnotation` directly sees nothing for `...rest: unknown[]`,
 * `input: unknown = fallback`, or a constructor's `private readonly input: unknown` — three
 * ordinary spellings, each a silent hole.
 */
export function parameterAnnotation(
  parameter: ESTree.ParamPattern,
): ESTree.TSTypeAnnotation | null | undefined {
  if (parameter.type === "TSParameterProperty") return parameterAnnotation(parameter.parameter);
  if (parameter.type === "RestElement") {
    return parameter.typeAnnotation ?? parameterAnnotation(parameter.argument);
  }
  if (parameter.type === "AssignmentPattern") {
    return parameter.typeAnnotation ?? parameter.left.typeAnnotation;
  }
  return parameter.typeAnnotation;
}

/**
 * The pattern a parameter destructures, or undefined when the parameter binds a plain name.
 *
 * A rule reading `parameter.type === "ObjectPattern"` directly sees nothing for
 * `({ a, b } = { a: 1, b: 2 })`, which is the defaulted spelling of the same destructure.
 *
 * ONE wrapper is seen through, not the three `parameterAnnotation` sees through, and the asymmetry
 * is a fact about the language rather than an omission. `constructor(private { a }: P)` is TS1187 —
 * a parameter property must name a binding — so `TSParameterProperty` can never hold one of these.
 * And `(...{ a, b })` destructures the ARGUMENTS ARRAY: its keys are `0`, `1`, `length`, not the
 * caller's object, so following the rest element would hand a caller a set of names that are not
 * the parameter's at all.
 */
export function parameterObjectPattern(
  parameter: ESTree.ParamPattern,
): ESTree.ObjectPattern | undefined {
  if (parameter.type === "AssignmentPattern") return parameterObjectPattern(parameter.left);
  return parameter.type === "ObjectPattern" ? parameter : undefined;
}

/** The parameter's name for the diagnostic, falling back to its source text when destructured. */
export function parameterName(parameter: ESTree.ParamPattern, sourceCode: SourceCode): string {
  if (parameter.type === "TSParameterProperty") return parameterName(parameter.parameter, sourceCode);
  if (parameter.type === "AssignmentPattern") return parameterName(parameter.left, sourceCode);
  if (parameter.type === "RestElement") return parameterName(parameter.argument, sourceCode);
  return parameter.type === "Identifier" ? parameter.name : sourceCode.getText(parameter);
}

const STATEMENT_LIST_NODES = new Set([
  "BlockStatement",
  "Program",
  "StaticBlock",
  "TSModuleBlock",
]);

/** A predicate, together with the params of the signature that predicate is written on. */
type TypeGuardDeclaration = {
  readonly predicate: ESTree.TSTypePredicate;
  readonly params: readonly ESTree.ParamPattern[];
};

function inlineTypePredicate(signature: ESTree.Node): ESTree.TSTypePredicate | null {
  if (!("returnType" in signature)) return null;
  const returned = signature.returnType?.typeAnnotation;
  return returned?.type === "TSTypePredicate" ? returned : null;
}

/**
 * The predicates the body-less overload signatures of the same function declare.
 *
 * An overloaded guard puts the predicate on the SIGNATURE and widens the implementation's own
 * return type — `function isInvoice(v: unknown): v is Invoice;` over
 * `function isInvoice(v: unknown): boolean { … }`. Read through the implementation alone, that
 * function vouches for nothing, though the contract every caller narrows through is exactly the
 * predicate above it.
 *
 * Matching by name across the whole statement list, with no adjacency check, is sound because
 * TypeScript itself rejects the alternative: an overload separated from its implementation is
 * TS2389, so a same-name pair that reaches this walk is an overload set or is already a compile
 * error. Every predicate-bearing signature is collected rather than the first, because an overload
 * set may lead with a fast path that declares none (`isId(value: string): boolean;`) and may
 * vouch for a different position in each signature.
 */
function overloadedTypePredicates(
  implementation: ESTree.Node,
  name: string,
): TypeGuardDeclaration[] {
  let container: ESTree.Node | null = implementation.parent;
  while (container !== null && !STATEMENT_LIST_NODES.has(container.type)) {
    container = container.parent;
  }
  if (container === null) return [];

  const siblings: readonly ESTree.Node[] =
    "body" in container && Array.isArray(container.body) ? container.body : [];
  const declared: TypeGuardDeclaration[] = [];
  for (const statement of siblings) {
    // An overload set on an exported guard wraps each signature, so the declaration to read is one
    // level down from the statement.
    const declaration =
      statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (declaration?.type !== "TSDeclareFunction" || declaration.id?.name !== name) continue;
    const predicate = inlineTypePredicate(declaration);
    if (predicate !== null) declared.push({ predicate, params: declaration.params });
  }
  return declared;
}

/**
 * The predicates the body-less overload signatures of the same METHOD declare.
 *
 * The class spelling of the same contract, and a different node the whole way down: the overload
 * is a `MethodDefinition` holding a `TSEmptyBodyFunctionExpression`, not a `TSDeclareFunction`,
 * and the name is a key rather than an id. Without this arm an overloaded guard written as a
 * method reports from both rules that read this file — the implementation body's `typeof` and the
 * `unknown` it takes — which is the edit loop the catalog forbids, since satisfying either message
 * is what wrote the method in the first place.
 *
 * `static` must match: TypeScript will not pair a static signature with an instance
 * implementation, so a same-name pair across that line is two members, not an overload set.
 */
function overloadedMethodTypePredicates(implementation: ESTree.Node): TypeGuardDeclaration[] {
  const member = implementation.parent;
  if (member?.type !== "MethodDefinition") return [];
  const name = staticKeyName(member.key, member.computed);
  if (name === undefined) return [];
  const body = member.parent;
  if (body?.type !== "ClassBody") return [];

  const declared: TypeGuardDeclaration[] = [];
  for (const sibling of body.body) {
    if (sibling.type !== "MethodDefinition") continue;
    if (sibling.value.type !== "TSEmptyBodyFunctionExpression") continue;
    if (sibling.static !== member.static) continue;
    if (staticKeyName(sibling.key, sibling.computed) !== name) continue;
    const predicate = inlineTypePredicate(sibling.value);
    if (predicate !== null) declared.push({ predicate, params: sibling.value.params });
  }
  return declared;
}

/**
 * Every predicate that vouches for `signature`'s inputs — its own, or its overload set's.
 *
 * A signature that declares its predicate inline answers for itself and does not consult the set:
 * the other signatures' predicates name positions in THEIR parameter lists, which is the same
 * reason the overload arms carry the declaring signature's params along with the predicate.
 */
function typeGuardDeclarations(signature: ESTree.Node): readonly TypeGuardDeclaration[] {
  if (!isSignatureNode(signature)) return [];
  const inline = inlineTypePredicate(signature);
  if (inline !== null) return [{ predicate: inline, params: signature.params }];
  if (signature.type === "FunctionDeclaration" && signature.id !== null) {
    return overloadedTypePredicates(signature, signature.id.name);
  }
  return signature.type === "FunctionExpression" ? overloadedMethodTypePredicates(signature) : [];
}

/**
 * Whether `signature` is a type guard — `value is Invoice`, `asserts value is Invoice`, or the
 * bare `asserts value` — declared inline or on one of its overload signatures.
 *
 * NEGATIVE SPACE: this asks whether the signature vouches for ANYTHING, which includes a predicate
 * over the receiver (`isPaid(): this is PaidInvoice`) that names no input at all. A caller that
 * needs the parameter a guard speaks for wants `typePredicateSubjectPositions`, which is empty for
 * exactly that case.
 */
export function declaresTypePredicate(signature: ESTree.Node): boolean {
  return typeGuardDeclarations(signature).length > 0;
}

/**
 * The positions of the parameters a guard vouches for — empty when `signature` is not a guard.
 *
 * POSITIONS and not names, because an overloaded guard reads its predicates off different
 * signatures than the one being checked: `isInvoice(v: unknown): v is Invoice;` may be implemented
 * as `isInvoice(value: unknown)`, where matching the predicate's `v` against the implementation's
 * params finds nothing. TypeScript requires the implementation to accept every overload
 * positionally, so the position carries across and the name does not.
 *
 * NEGATIVE SPACE: a predicate over `this` (`this is Paid`) names no parameter and so exempts none
 * — `this` is not in `params`, and every declared parameter of such a method still answers for
 * itself.
 */
export function typePredicateSubjectPositions(
  signature: ESTree.Node,
  sourceCode: SourceCode,
): ReadonlySet<number> {
  const positions = new Set<number>();
  for (const guard of typeGuardDeclarations(signature)) {
    const subject = guard.predicate.parameterName;
    if (subject.type !== "Identifier") continue;
    const position = guard.params.findIndex(
      (parameter) => parameterName(parameter, sourceCode) === subject.name,
    );
    if (position !== -1) positions.add(position);
  }
  return positions;
}

/** Visitor keys from `context.sourceCode.visitorKeys`, used to walk a subtree for infer binders. */
type VisitorKeys = Readonly<Record<string, readonly string[]>>;

function isEstreeNode(value: unknown): value is ESTree.Node {
  return (
    typeof value === "object" && value !== null && "type" in value && typeof value.type === "string"
  );
}

function collectInferTypeParameterNames(
  node: ESTree.Node,
  visitorKeys: VisitorKeys,
  names: Set<string>,
): void {
  // A nested conditional owns the binders declared in ITS extends clause, and they are visible only
  // in ITS true branch — `T extends (X extends infer Item ? A : B) ? …` leaves `Item` meaning the
  // module alias again out here. Collecting through the nesting shadows a name the outer branch can
  // still legitimately use, and a shadowed name is one the broad-type rules stop resolving: the
  // rule goes silent, which is the failure this catalog cannot see without a case for it.
  //
  // Only the nesting stops the walk. `Promise<infer U>` and `(infer U)[]` are ordinary positions
  // inside this conditional's own extends clause and must still be collected.
  if (node.type === "TSConditionalType") return;
  if (node.type === "TSInferType") names.add(node.typeParameter.name.name);
  const record = node as unknown as Readonly<Record<string, unknown>>;
  for (const key of visitorKeys[node.type] ?? []) {
    const value = record[key];
    if (isEstreeNode(value)) {
      collectInferTypeParameterNames(value, visitorKeys, names);
      continue;
    }
    if (!Array.isArray(value)) continue;
    for (const child of value) {
      if (isEstreeNode(child)) collectInferTypeParameterNames(child, visitorKeys, names);
    }
  }
}

/**
 * Type parameter names in scope at `node`, which must never be resolved as aliases.
 *
 * `function box<Unknown>(value: Unknown)` names a type parameter, not the top type. Without this,
 * a file that happens to name a generic after an alias gets a false positive that reads as the
 * rule being broken — the failure mode that trains people to disable it.
 *
 * Two binders have scopes narrower than their subtree, so the walk tracks which child it came up
 * from: a mapped type's key binds only in the name and value positions (`[K in X]` cannot
 * reference `K` in `X`), and an `infer` binder declared in an extends clause is visible only in
 * the conditional's TRUE branch — in the false branch the same name still means the module alias.
 */
export function lexicalTypeParameterNames(
  node: ESTree.Node,
  visitorKeys: VisitorKeys,
): ReadonlySet<string> {
  const names = new Set<string>();
  let descendant: ESTree.Node = node;
  let current: ESTree.Node | null = node;
  while (current !== null && current.type !== "Program") {
    if ("typeParameters" in current) {
      for (const parameter of current.typeParameters?.params ?? []) names.add(parameter.name.name);
    }
    if (
      current.type === "TSMappedType" &&
      (descendant === current.nameType || descendant === current.typeAnnotation)
    ) {
      names.add(current.key.name);
    }
    if (current.type === "TSConditionalType" && descendant === current.trueType) {
      collectInferTypeParameterNames(current.extendsType, visitorKeys, names);
    }
    descendant = current;
    current = current.parent;
  }
  return names;
}

/**
 * The file's non-generic `type X = …` declarations.
 *
 * Collected from `Program` in one pass rather than as the walk encounters them, because a type
 * alias is routinely declared below the signature that uses it.
 */
export function collectLocalTypeAliases(program: ESTree.Program): Map<string, ESTree.TSType> {
  const aliases = new Map<string, ESTree.TSType>();
  for (const statement of program.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (
      declaration?.type === "TSTypeAliasDeclaration" &&
      (declaration.typeParameters === null || declaration.typeParameters === undefined)
    ) {
      aliases.set(declaration.id.name, declaration.typeAnnotation);
    }
  }
  return aliases;
}

/**
 * Whether `type` resolves to one of `broadKeywords` through unions, promises, and local aliases.
 *
 * A union is broad when ANY member is, because `unknown | string` collapses to `unknown` and
 * `object | Invoice` still admits every object. Generic aliases are not followed: their bodies are
 * written in terms of parameters this tier cannot substitute, so resolving one would report
 * against a type argument that may never be broad at any real use.
 */
export function resolvesToBroadType(
  type: ESTree.TSType,
  broadKeywords: ReadonlySet<string>,
  aliases: ReadonlyMap<string, ESTree.TSType>,
  shadowed: ReadonlySet<string>,
  visited: ReadonlySet<string> = new Set(),
): boolean {
  if (broadKeywords.has(type.type)) return true;
  if (type.type === "TSUnionType") {
    return type.types.some((member) =>
      resolvesToBroadType(member, broadKeywords, aliases, shadowed, visited),
    );
  }
  // `unknown[]` is the same refusal wearing a container, and it is the ONLY way a rest parameter
  // can be spelled — `...args: unknown` does not parse — so without this the rest-parameter path
  // is unreachable rather than merely untested.
  //
  // Tuples are deliberately not treated this way: `[unknown, string]` has a known arity and a
  // known second slot, which is a real structure rather than a refusal to describe one.
  if (type.type === "TSArrayType") {
    return resolvesToBroadType(type.elementType, broadKeywords, aliases, shadowed, visited);
  }
  if (type.type === "TSTypeOperator" && type.operator === "readonly") {
    return resolvesToBroadType(type.typeAnnotation, broadKeywords, aliases, shadowed, visited);
  }
  if (type.type !== "TSTypeReference" || type.typeName.type !== "Identifier") return false;

  const name = type.typeName.name;
  const typeArguments = type.typeArguments?.params ?? [];
  if (PROMISE_TYPE_NAMES.has(name)) {
    const payload = typeArguments[0];
    return (
      payload !== undefined &&
      resolvesToBroadType(payload, broadKeywords, aliases, shadowed, visited)
    );
  }

  if (typeArguments.length > 0 || visited.has(name) || shadowed.has(name)) return false;
  const alias = aliases.get(name);
  if (alias === undefined) return false;
  return resolvesToBroadType(alias, broadKeywords, aliases, shadowed, new Set([...visited, name]));
}

// ── The open-dictionary question ──
//
// "Is this type an open dictionary, and is its value opaque?" is the tag's third shared question,
// and it was answered three ways before this section existed: `types/no-opaque-record` read the key
// of a mapped type but not of a `Record`, `types/no-widen-then-assert` never handled a mapped type
// at all, and `types/no-known-value-widening` called every `Record` open whatever its key domain.
// The three disagreed on six spellings of the same type, which is how a widen-then-assert through
// `{ [K in string]: unknown }` went unreported while the identical `Record<string, unknown>` did not.
//
// The KEY half is shared outright — it has one answer. The VALUE half is shared by the two rules
// that ask it; `types/no-known-value-widening` deliberately does not, because what an annotation
// takes from a literal is its keys, so `Record<string, Handler>` reports there and must stay silent
// in the other two. That is the one real divergence and it is pinned by that fixture in all three
// specs.

const RECORD_TYPE_NAME = "Record";

const OPEN_KEY_DOMAIN_KEYWORDS: ReadonlySet<string> = new Set([
  "TSStringKeyword",
  "TSNumberKeyword",
  "TSSymbolKeyword",
]);

const OPEN_KEY_TYPE_NAMES: ReadonlySet<string> = new Set(["PropertyKey"]);

/**
 * A dictionary value that carries no information: `unknown`, `any`, or `object`.
 *
 * `object` sits with the top types because as a VALUE it is the same bag — it admits every
 * non-primitive and supports no property read without a cast. That is a different judgement from
 * `object` elsewhere, which is why this set is named for the position it governs.
 */
export const OPAQUE_DICTIONARY_VALUE_KEYWORDS: ReadonlySet<string> = new Set([
  "TSUnknownKeyword",
  "TSAnyKeyword",
  "TSObjectKeyword",
]);

/**
 * Whether a key domain admits keys nobody wrote down — `string`, `number`, `symbol`, `PropertyKey`,
 * `keyof any`, or a union containing one of them, reached through local aliases.
 *
 * ASKED ONLY WHERE A CLOSED DOMAIN CAN BE SPELLED, which is `Record<K, V>` and a mapped type's
 * constraint. An index signature is NOT gated on this: TypeScript rejects a literal key there
 * (TS1336), so every index signature that compiles already has an open domain, and testing the key
 * would only lose the template-literal spelling.
 *
 * NEGATIVE SPACE: `keyof T` for any T other than `any` is closed, and so is a union of string
 * literals — that is the point, since `{ [K in keyof T]: unknown }` is a dirty-field tracker rather
 * than a bag. A template-literal key domain is open in fact and reads as closed here; it is
 * unreachable from the two callers, since neither a `Record` argument nor a mapped constraint is
 * commonly spelled that way.
 */
export function isOpenKeyDomain(
  type: ESTree.TSType,
  aliases: ReadonlyMap<string, ESTree.TSType>,
  shadowed: ReadonlySet<string>,
  visited: ReadonlySet<string> = new Set(),
): boolean {
  if (OPEN_KEY_DOMAIN_KEYWORDS.has(type.type)) return true;
  if (type.type === "TSUnionType") {
    return type.types.some((member) => isOpenKeyDomain(member, aliases, shadowed, visited));
  }
  // `keyof any` is `PropertyKey` spelled the long way round. Every other `keyof` names a shape.
  if (type.type === "TSTypeOperator" && type.operator === "keyof") {
    return type.typeAnnotation.type === "TSAnyKeyword";
  }
  if (type.type !== "TSTypeReference" || type.typeName.type !== "Identifier") return false;

  const name = type.typeName.name;
  if (shadowed.has(name)) return false;
  if (OPEN_KEY_TYPE_NAMES.has(name)) return true;
  if ((type.typeArguments?.params.length ?? 0) > 0 || visited.has(name)) return false;
  const alias = aliases.get(name);
  if (alias === undefined) return false;
  return isOpenKeyDomain(alias, aliases, shadowed, new Set([...visited, name]));
}

/**
 * Whether a dictionary's value type is an opaque bag, through unions, wrappers and local aliases.
 *
 * `resolvesToBroadType` owns the walk, so `Record<string, Opaque | string>` over
 * `type Opaque = unknown` is reported rather than being read as a two-member union — the union arm
 * that tested members against literal keywords and did not recurse was a two-line bypass of the
 * whole rule.
 *
 * `Record<string, object | string>` reports for the same reason. A union does not launder a broad
 * member: it is the retreat an agent writes once `Record<string, object>` is refused, and neither
 * branch supports a property read without narrowing first.
 */
export function isOpaqueDictionaryValue(
  type: ESTree.TSType,
  aliases: ReadonlyMap<string, ESTree.TSType>,
  shadowed: ReadonlySet<string>,
): boolean {
  return resolvesToBroadType(type, OPAQUE_DICTIONARY_VALUE_KEYWORDS, aliases, shadowed);
}

/**
 * The value type of an open dictionary — `Record<K, V>`, `{ [k: K]: V }`, `{ [K in K]: V }` — or
 * `null` when `type` is not one.
 *
 * For the callers that read a whole annotation rather than visiting its parts. The value comes back
 * instead of a boolean because the two rules that ask disagree on what to do with it: one asks
 * whether it is opaque, the other does not ask at all.
 *
 * A type literal carrying other members ALONGSIDE an index signature is still an open dictionary —
 * `{ id: string; [k: string]: unknown }` accepts every key a bag does, and `id` being typed does
 * not close it. `types/no-opaque-record` has always read it that way through its interface arm;
 * this is where the other two stopped disagreeing.
 *
 * NEGATIVE SPACE: only the FIRST index signature is returned, so a type literal declaring both a
 * string and a number index is judged on whichever comes first.
 */
export function openDictionaryValueType(
  type: ESTree.TSType,
  aliases: ReadonlyMap<string, ESTree.TSType>,
  shadowed: ReadonlySet<string>,
  visited: ReadonlySet<string> = new Set(),
): ESTree.TSType | null {
  if (type.type === "TSMappedType") {
    const value = type.typeAnnotation;
    if (value === null || value === undefined) return null;
    return isOpenKeyDomain(type.constraint, aliases, shadowed) ? value : null;
  }
  if (type.type === "TSTypeLiteral") {
    for (const member of type.members) {
      if (member.type !== "TSIndexSignature") continue;
      return member.typeAnnotation.typeAnnotation;
    }
    return null;
  }
  if (type.type !== "TSTypeReference" || type.typeName.type !== "Identifier") return null;

  const name = type.typeName.name;
  if (shadowed.has(name)) return null;
  const typeArguments = type.typeArguments?.params ?? [];
  if (name === RECORD_TYPE_NAME) {
    const [key, value] = typeArguments;
    if (typeArguments.length !== 2 || key === undefined || value === undefined) return null;
    return isOpenKeyDomain(key, aliases, shadowed) ? value : null;
  }
  // A local alias to the bag is the bag. A generic alias is not followed, for the same reason
  // `resolvesToBroadType` does not follow one: its body is written in terms of parameters this tier
  // cannot substitute.
  if (typeArguments.length > 0 || visited.has(name)) return null;
  const alias = aliases.get(name);
  if (alias === undefined) return null;
  return openDictionaryValueType(alias, aliases, shadowed, new Set([...visited, name]));
}
