// Shared reading of TypeScript annotations for the `types` tag.
//
// Every rule in that tag asks a version of the same question — "does this annotation resolve to a
// type that carries no information?" — and each one can be beaten by the same three spellings: a
// union that buries the broad member, a local alias that renames it, and a generic wrapper that
// hides it one level down. Answering that once here is what stops each rule shipping its own
// near-copy, which is exactly how five of this catalog's GritQL rules ended up over-matching in
// subtly different ways.
//
// ── Adapt ──
// `PROMISE_TYPE_NAMES` exists because `Promise<unknown>` is an unknown contract wearing a wrapper;
// add project-specific containers (`Result`, `Option`) whose type argument is the real payload.
// Generic aliases are deliberately NOT resolved through — see `resolvesToBroadType`.

import type { ESTree, SourceCode } from "@oxlint/plugins";

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

/** The parameter's name for the diagnostic, falling back to its source text when destructured. */
export function parameterName(parameter: ESTree.ParamPattern, sourceCode: SourceCode): string {
  if (parameter.type === "TSParameterProperty") return parameterName(parameter.parameter, sourceCode);
  if (parameter.type === "AssignmentPattern") return parameterName(parameter.left, sourceCode);
  if (parameter.type === "RestElement") return parameterName(parameter.argument, sourceCode);
  return parameter.type === "Identifier" ? parameter.name : sourceCode.getText(parameter);
}

/**
 * Type parameter names in scope at `node`, which must never be resolved as aliases.
 *
 * `function box<Unknown>(value: Unknown)` names a type parameter, not the top type. Without this,
 * a file that happens to name a generic after an alias gets a false positive that reads as the
 * rule being broken — the failure mode that trains people to disable it.
 */
export function lexicalTypeParameterNames(node: ESTree.Node): ReadonlySet<string> {
  const names = new Set<string>();
  let current: ESTree.Node | null = node;
  while (current !== null && current.type !== "Program") {
    if ("typeParameters" in current) {
      for (const parameter of current.typeParameters?.params ?? []) names.add(parameter.name.name);
    }
    if (current.type === "TSMappedType") names.add(current.key.name);
    if (current.type === "TSInferType") names.add(current.typeParameter.name.name);
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
