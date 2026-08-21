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
// "Is this type an open dictionary, and is its value opaque?" is the tag's third shared question.
// Three rules ask it, and without one owner they answer it differently in a way nothing can see:
// each stays green while going silent on a spelling its sibling reports.
//
// The KEY half is shared outright. The VALUE half is shared by the two rules that ask it —
// `types/no-known-value-widening` does not, because what an annotation takes from a literal is its
// keys, so `Record<string, Handler>` reports there and must stay silent in the other two. That is
// the one divergence, and a fixture in all three specs pins it.

const RECORD_TYPE_NAME = "Record";

/**
 * A dictionary value that carries no information: `unknown`, `any`, or `object`.
 *
 * `object` sits with the top types because as a VALUE it is the same bag — it admits every
 * non-primitive and supports no property read without a cast. That is a different judgement from
 * `object` elsewhere, which is why this set is named for the position it governs.
 */
const OPAQUE_DICTIONARY_VALUE_KEYWORDS: ReadonlySet<string> = new Set([
  "TSUnknownKeyword",
  "TSAnyKeyword",
  "TSObjectKeyword",
]);

// TypeScript built-ins that hand back a subset of their FIRST argument's domain, so they are closed
// exactly when it is. `Extract<keyof T, string>` and `Exclude<keyof T, "id">` are the ordinary way
// to write "some of T's keys"; `Lowercase<string>` is still every string and must stay open.
const KEY_PRESERVING_TYPE_NAMES: ReadonlySet<string> = new Set([
  "Capitalize",
  "Exclude",
  "Extract",
  "Lowercase",
  "NoInfer",
  "Uncapitalize",
  "Uppercase",
]);

/**
 * The file-level declarations the open-dictionary predicates resolve a name against.
 *
 * Grouped rather than passed as three sets, because every caller needs all of them and a name means
 * nothing without the whole group: `Status` is a closed domain if the file declares it as an enum,
 * an open one if it declares it as `type Status = string`, and unresolvable if it imports it.
 */
export type LocalTypeFacts = {
  readonly aliases: ReadonlyMap<string, ESTree.TSType>;
  /** `enum X {…}` names declared in this file — a finite domain whose members are not TSTypes. */
  readonly enums: ReadonlySet<string>;
};

/** Every local type alias and enum name, collected from `Program` in one pass. */
export function collectLocalTypeFacts(program: ESTree.Program): LocalTypeFacts {
  const enums = new Set<string>();
  for (const statement of program.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (declaration?.type === "TSEnumDeclaration") enums.add(declaration.id.name);
  }
  return { aliases: collectLocalTypeAliases(program), enums };
}

/**
 * Whether a key domain admits keys nobody wrote down.
 *
 * ENUMERATES WHAT IS CLOSED AND CALLS EVERYTHING ELSE OPEN, which is the only direction that can
 * fail loudly. A predicate listing the OPEN spellings instead reads as more precise and goes silent
 * on every one it has not thought of — `Record<any, unknown>`, `` Record<`user_${string}`, unknown> ``,
 * `Record<Lowercase<string>, unknown>` and `Record<string & {}, unknown>` are all bags, and each is
 * a one-token bypass that a green suite cannot distinguish from coverage.
 *
 * The cost of that direction is the other kind of mistake, and it has to be paid down by hand:
 * every closed domain the walk cannot NAME reports. So the closed list covers the spellings a
 * project actually writes — a literal type, a union of them, an enum or one of its members, an
 * indexed access, `keyof X` for any X but `any`, the key-preserving built-ins, a type parameter in
 * scope, and a local alias to any of those.
 *
 * ASKED ONLY WHERE A CLOSED DOMAIN CAN BE SPELLED, which is a `Record` argument and a mapped type's
 * constraint. An index signature is not gated on it: TypeScript rejects a literal key there
 * (TS1336), so every index signature that compiles already has an open domain.
 *
 * NEGATIVE SPACE: a domain this walk cannot resolve reports even when it is finite in fact — an
 * IMPORTED alias or enum, a conditional type, and a template literal over a local prefix
 * (`` `${Prefix}_id` ``, which is not distinguishable here from `` `user_${string}` ``). The fix is
 * to spell the union or name the shape; the alternative is silence on every key spelling this file
 * has not enumerated, which is the failure that cannot be seen.
 */
export function isOpenKeyDomain(
  type: ESTree.TSType,
  facts: LocalTypeFacts,
  shadowed: ReadonlySet<string>,
): boolean {
  return !isClosedKeyDomain(type, facts, shadowed, new Set());
}

function isClosedKeyDomain(
  type: ESTree.TSType,
  facts: LocalTypeFacts,
  shadowed: ReadonlySet<string>,
  visited: ReadonlySet<string>,
): boolean {
  if (type.type === "TSLiteralType") return true;
  // `Row["id"]` and `(typeof KEYS)[number]` name a slice of a type someone declared. The second is
  // the canonical spelling of a closed domain in TypeScript, so treating it as open reports the
  // idiom the rule's own message asks for.
  if (type.type === "TSIndexedAccessType") return true;
  // A union is closed only when EVERY member is, and an intersection when ANY member is, because an
  // intersection can only narrow. `keyof T & string` is the common spelling of the second, and
  // `string & {}` — the trick that stops a literal union widening — of the first.
  if (type.type === "TSUnionType") {
    return type.types.every((member) => isClosedKeyDomain(member, facts, shadowed, visited));
  }
  if (type.type === "TSIntersectionType") {
    return type.types.some((member) => isClosedKeyDomain(member, facts, shadowed, visited));
  }
  // `keyof any` is `PropertyKey` spelled the long way round. Every other `keyof` names a shape.
  if (type.type === "TSTypeOperator" && type.operator === "keyof") {
    return type.typeAnnotation.type !== "TSAnyKeyword";
  }
  if (type.type !== "TSTypeReference") return false;
  // `Status.Draft` — an enum member, which is a single key however the enum is declared.
  if (type.typeName.type !== "Identifier") return type.typeName.type === "TSQualifiedName";

  const name = type.typeName.name;
  // A type parameter names whatever the caller supplies. Reporting a generic utility for a domain
  // that no use site may ever open is the false positive that trains people to disable a rule.
  if (shadowed.has(name)) return true;
  if (facts.enums.has(name)) return true;
  const typeArguments = type.typeArguments?.params ?? [];
  const preserved = typeArguments[0];
  if (KEY_PRESERVING_TYPE_NAMES.has(name)) {
    return preserved !== undefined && isClosedKeyDomain(preserved, facts, shadowed, visited);
  }
  // No generic-argument check on the alias path, unlike `resolvesToBroadType`: `aliases` holds
  // non-generic aliases only, so a generic reference misses and falls to the open default already.
  // There the default runs the other way, which is what makes the check load-bearing there.
  if (visited.has(name)) return false;
  const alias = facts.aliases.get(name);
  if (alias === undefined) return false;
  return isClosedKeyDomain(alias, facts, shadowed, new Set([...visited, name]));
}

/**
 * Whether a dictionary's value type is an opaque bag, through unions, wrappers and local aliases.
 *
 * `resolvesToBroadType` owns the walk, so the broad member is found however it is buried:
 * `Record<string, Opaque | string>` over `type Opaque = unknown` is two tidy-looking lines that
 * hand back the whole bag. A union laundering a broad member is likewise no exemption —
 * `Record<string, object | string>` is the retreat once `Record<string, object>` is refused, and
 * neither branch supports a property read without narrowing first.
 */
export function isOpaqueDictionaryValue(
  type: ESTree.TSType,
  facts: LocalTypeFacts,
  shadowed: ReadonlySet<string>,
): boolean {
  return resolvesToBroadType(type, OPAQUE_DICTIONARY_VALUE_KEYWORDS, facts.aliases, shadowed);
}

/** A dictionary's two halves. `key` is null for an index signature, which has no closed spelling. */
export type DictionaryShape = {
  readonly key: ESTree.TSType | null;
  readonly value: ESTree.TSType;
};

/**
 * The two halves of a dictionary — `Record<K, V>`, `{ [k: K]: V }`, `{ [K in K]: V }`, or a local
 * alias to one — or `null` when `type` is not a dictionary at all.
 *
 * OPEN OR CLOSED, deliberately: the callers want different halves. `openDictionaryValueType` asks
 * the key question on top of this; `types/no-widen-then-assert` asks whether an assertion target is
 * a dictionary AT ALL, and a closed-keyed one is exactly what recovering from a bag looks like.
 *
 * A type literal carrying other members ALONGSIDE an index signature is still a dictionary —
 * `{ id: string; [k: string]: unknown }` accepts every key a bag does, and `id` being typed does
 * not close it. Requiring the literal to hold nothing else is the cheapest way out of a rule.
 *
 * NEGATIVE SPACE: only the FIRST index signature is read, so a type literal declaring both a string
 * and a number index is judged on whichever comes first.
 */
export function dictionaryShape(
  type: ESTree.TSType,
  facts: LocalTypeFacts,
  shadowed: ReadonlySet<string>,
  visited: ReadonlySet<string> = new Set(),
): DictionaryShape | null {
  if (type.type === "TSMappedType") {
    const value = type.typeAnnotation;
    return value === null || value === undefined ? null : { key: type.constraint, value };
  }
  if (type.type === "TSTypeLiteral") {
    for (const member of type.members) {
      if (member.type !== "TSIndexSignature") continue;
      return { key: null, value: member.typeAnnotation.typeAnnotation };
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
    return { key, value };
  }
  // A local alias to the bag is the bag. A generic alias is not followed, for the same reason
  // `resolvesToBroadType` does not follow one: its body is written in terms of parameters this tier
  // cannot substitute.
  if (typeArguments.length > 0 || visited.has(name)) return null;
  const alias = facts.aliases.get(name);
  if (alias === undefined) return null;
  return dictionaryShape(alias, facts, shadowed, new Set([...visited, name]));
}

/**
 * The value type of a dictionary whose key domain is OPEN, or `null` for anything else.
 *
 * The bag question in one call, for the callers that read a whole annotation rather than visiting
 * its parts. The value comes back instead of a boolean because the rules that ask disagree on what
 * to do with it: one asks whether it is opaque, the other does not ask at all.
 */
export function openDictionaryValueType(
  type: ESTree.TSType,
  facts: LocalTypeFacts,
  shadowed: ReadonlySet<string>,
): ESTree.TSType | null {
  const shape = dictionaryShape(type, facts, shadowed);
  if (shape === null) return null;
  return shape.key === null || isOpenKeyDomain(shape.key, facts, shadowed) ? shape.value : null;
}
