// ─── types/no-widen-then-assert ──────────────────────────────────────
//
// Tag:      types
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: A local flow that throws a known type away and then claims
//           it back:
//
//             const loaded: User = loadUser();
//             const stored: unknown = loaded;   // evidence discarded
//             const user = stored as User;      // evidence invented
//
//           Nothing is checked in the middle. The round trip converts a
//           type the compiler was enforcing into one it is merely being
//           told, and the assertion at the end looks like diligence.
//
//           This reads as a mistake nobody would make, and for a person
//           writing the three lines together it is. It is here because
//           agents do not write them together: the widening is how a
//           model silences a type error it does not understand, the
//           assertion is a later edit restoring the type it needs, and
//           nothing re-reads the pair as a whole. Two plausible edits
//           compose into something neither one looks like.
//
//           `types/require-safety-comment` does NOT cover this. It fires
//           on the same line, but the compliant response is to write
//           `// SAFETY: stored came from loaded, which is a User` — a
//           true sentence that documents the round trip instead of
//           deleting it, and permanently silences the linter. Verified
//           against oxlint 1.77.0. Adopting the safety rule without this
//           one makes prose the cheapest fix for a pattern whose only
//           correct fix is deletion.
//
// Excludes: Values that were never known — `JSON.parse(text)`, an
//           already-`unknown` parameter, a fetch body. Those genuinely
//           arrive untyped, and asserting them is a boundary-parsing
//           problem this rule deliberately says nothing about.
//
// Applies:  All .ts and .tsx files EXCEPT:
//           - Test files and scripts
//
// Error:    "`{{name}}` had a known type, discarded it, and this
//            assertion invents it back. Nothing was checked in between.
//            Delete the widening and keep the original type through to
//            here."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. What counts as widening — `broadTypeKind`:
//    Three kinds are recognised: `unknown`/`any` ("top"), the `object`
//    keyword, and the open dictionary (`Record<K, unknown>` and its
//    index-signature spelling). A project wanting only the dominant
//    case can return `null` for everything but "top" and delete
//    `isDefinitelyObjectType` and `isDefinitelyNarrowerRecordType` with
//    it — that is roughly half this file, and it keeps the pattern that
//    actually shows up in generated code.
//
// 2. What counts as evidence — `knownValueEvidence`:
//    A value is "known" if it is written out (a literal, an object or
//    array expression, `new X()`), if it is asserted to a non-broad
//    type, or if it is a binding carrying a non-broad annotation. It is
//    deliberately NOT known when it comes from a bare call, because
//    `const x: unknown = parseInput()` is a boundary, not a mistake.
//    Widening the definition to follow call return types needs a type
//    checker and does not belong in this tier.
//
// 3. Same-function only — `functionBoundary`:
//    Both the widening and the assertion must sit in the same function.
//    Crossing a closure means the two lines have different authors in
//    practice, and the flow between them is no longer local enough for
//    a per-file rule to call it pointless.
//
// 4. No parenthesis handling anywhere in this file, on purpose:
//    oxlint's AST surfaces neither `ParenthesizedExpression` nor
//    `TSParenthesizedType` — `(value) as (User)` arrives as the bare
//    nodes. Verified against oxlint 1.77.0; the spec asserts the
//    parenthesized spelling still reports, so this goes red rather than
//    silent if a future version starts surfacing them.
//
// 5. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-widen-then-assert": noWidenThenAssertRule }`) and
//    turn it on in `.oxlintrc.json`
//    (`"<plugin>/no-widen-then-assert": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree, type Scope, type SourceCode, type Variable } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

type TypeAssertion = ESTree.TSAsExpression | ESTree.TSTypeAssertion;
type BroadKind = "top" | "object" | "record";

const FUNCTION_NODES = new Set([
  "ArrowFunctionExpression",
  "FunctionDeclaration",
  "FunctionExpression",
  "TSDeclareFunction",
  "TSEmptyBodyFunctionExpression",
]);

// Values that are their own evidence: what they are is visible in the source, so widening one is
// always a loss. A CallExpression is absent on purpose — see Adapt note 2.
const SELF_EVIDENT_EXPRESSIONS = new Set([
  "ArrayExpression",
  "ArrowFunctionExpression",
  "ClassExpression",
  "FunctionExpression",
  "Literal",
  "NewExpression",
  "ObjectExpression",
  "TemplateLiteral",
]);

function typeReferenceName(type: ESTree.TSType): string | null {
  return type.type === "TSTypeReference" && type.typeName.type === "Identifier"
    ? type.typeName.name
    : null;
}

function isTopType(type: ESTree.TSType): boolean {
  return type.type === "TSUnknownKeyword" || type.type === "TSAnyKeyword";
}

function isOpenKeyDomain(type: ESTree.TSType): boolean {
  if (
    type.type === "TSStringKeyword" ||
    type.type === "TSNumberKeyword" ||
    type.type === "TSSymbolKeyword"
  ) {
    return true;
  }
  return typeReferenceName(type) === "PropertyKey";
}

function isOpenDictionary(type: ESTree.TSType): boolean {
  if (typeReferenceName(type) === "Record") {
    const params = type.type === "TSTypeReference" ? (type.typeArguments?.params ?? []) : [];
    const [key, value] = params;
    return params.length === 2 && key !== undefined && value !== undefined && isOpenKeyDomain(key) && isTopType(value);
  }
  if (type.type !== "TSTypeLiteral" || type.members.length !== 1) return false;
  const [member] = type.members;
  if (member?.type !== "TSIndexSignature") return false;
  const [parameter] = member.parameters;
  return (
    parameter !== undefined &&
    isOpenKeyDomain(parameter.typeAnnotation.typeAnnotation) &&
    isTopType(member.typeAnnotation.typeAnnotation)
  );
}

function broadTypeKind(type: ESTree.TSType): BroadKind | null {
  if (isTopType(type)) return "top";
  if (type.type === "TSObjectKeyword") return "object";
  return isOpenDictionary(type) ? "record" : null;
}

function isDefinitelyObjectType(type: ESTree.TSType): boolean {
  switch (type.type) {
    case "TSArrayType":
    case "TSConstructorType":
    case "TSFunctionType":
    case "TSMappedType":
    case "TSObjectKeyword":
    case "TSTupleType":
      return true;
    case "TSTypeLiteral":
      return type.members.length > 0;
    case "TSIntersectionType":
      return type.types.every(isDefinitelyObjectType);
    case "TSTypeOperator":
      return type.operator === "readonly" && isDefinitelyObjectType(type.typeAnnotation);
    default:
      return false;
  }
}

function isDefinitelyNarrowerDictionary(type: ESTree.TSType): boolean {
  if (type.type === "TSTypeLiteral") {
    return type.members.some((member) => member.type !== "TSIndexSignature");
  }
  if (typeReferenceName(type) !== "Record") return false;
  const params = type.type === "TSTypeReference" ? (type.typeArguments?.params ?? []) : [];
  const value = params[1];
  return params.length === 2 && value !== undefined && !isTopType(value);
}

function resolveVariable(sourceCode: SourceCode, identifier: ESTree.IdentifierReference): Variable | null {
  let scope: Scope | null = sourceCode.getScope(identifier);
  while (scope !== null) {
    const variable = scope.set.get(identifier.name);
    if (variable !== undefined) return variable;
    scope = scope.upper;
  }
  return null;
}

function functionBoundary(node: ESTree.Node): ESTree.Node | null {
  let current: ESTree.Node | null = node.parent;
  while (current !== null && current.type !== "Program") {
    if (FUNCTION_NODES.has(current.type)) return current;
    current = current.parent;
  }
  return null;
}

function soleDeclarator(variable: Variable): ESTree.VariableDeclarator | null {
  if (variable.defs.length !== 1) return null;
  const [definition] = variable.defs;
  return definition?.type === "Variable" && definition.node.type === "VariableDeclarator"
    ? definition.node
    : null;
}

// A binding that is reassigned is not a flow this rule can reason about: the value at the assertion
// may not be the value that was widened.
function isStableConst(variable: Variable, declarator: ESTree.VariableDeclarator): boolean {
  return (
    declarator.parent.type === "VariableDeclaration" &&
    declarator.parent.kind === "const" &&
    variable.references.every((reference) => reference.init || !reference.isWrite())
  );
}

function assertionOf(expression: ESTree.Expression): TypeAssertion | null {
  return expression.type === "TSAsExpression" || expression.type === "TSTypeAssertion"
    ? expression
    : null;
}

export const noWidenThenAssertRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      widenThenAssert:
        "`{{name}}` had a known type, discarded it, and this assertion invents it back. Nothing was checked in between. Delete the widening and keep the original type through to here.",
    },
  },
  create(context) {
    if (isArchitectureExemptPath(context.filename)) return {};

    const sourceCode = context.sourceCode;

    // Returns the type the value was known to be, or `{ type: null }` when it is self-evident but
    // unnamed (a literal, an object expression). `null` means no evidence — the value was never
    // known, so widening it discarded nothing.
    function knownValueEvidence(
      expression: ESTree.Expression,
      boundary: ESTree.Node | null,
      visited: ReadonlySet<Variable>,
    ): { type: ESTree.TSType | null } | null {
      const assertion = assertionOf(expression);
      if (assertion !== null) {
        return broadTypeKind(assertion.typeAnnotation) === null
          ? { type: assertion.typeAnnotation }
          : null;
      }
      if (SELF_EVIDENT_EXPRESSIONS.has(expression.type)) return { type: null };
      if (expression.type !== "Identifier") return null;

      const variable = resolveVariable(sourceCode, expression);
      if (variable === null || visited.has(variable)) return null;

      // An explicit annotation is evidence on its own, whatever the initializer was. This is what
      // makes `const loaded: User = loadUser()` count while a bare `loadUser()` does not: the
      // author named the type, so discarding it later is a decision rather than a boundary.
      const annotated = variable.identifiers.find(
        (identifier) => identifier.typeAnnotation !== null && identifier.typeAnnotation !== undefined,
      );
      const annotation = annotated?.typeAnnotation?.typeAnnotation;
      if (annotation !== undefined && annotated !== undefined) {
        return functionBoundary(annotated) === boundary && broadTypeKind(annotation) === null
          ? { type: annotation }
          : null;
      }

      const declarator = soleDeclarator(variable);
      if (
        declarator === null ||
        declarator.init === null ||
        !isStableConst(variable, declarator) ||
        functionBoundary(declarator) !== boundary
      ) {
        return null;
      }
      return knownValueEvidence(declarator.init, boundary, new Set([...visited, variable]));
    }

    function widenedBinding(variable: Variable) {
      const declarator = soleDeclarator(variable);
      if (
        declarator === null ||
        declarator.id.type !== "Identifier" ||
        declarator.init === null ||
        !isStableConst(variable, declarator)
      ) {
        return null;
      }

      const boundary = functionBoundary(declarator);
      const declaredType = declarator.id.typeAnnotation?.typeAnnotation;
      const initAssertion = assertionOf(declarator.init);
      const initBroadKind =
        initAssertion === null ? null : broadTypeKind(initAssertion.typeAnnotation);
      // Both spellings of the same widening: `const x: unknown = v` and `const x = v as unknown`.
      const broadKind =
        (declaredType === undefined ? null : broadTypeKind(declaredType)) ?? initBroadKind;
      if (broadKind === null) return null;

      const original =
        initAssertion !== null && initBroadKind !== null ? initAssertion.expression : declarator.init;
      const evidence = knownValueEvidence(original, boundary, new Set([variable]));
      return evidence === null ? null : { broadKind, evidence, declaredAt: declarator.end, boundary };
    }

    function assertionRecoversEvidence(
      broadKind: BroadKind,
      evidence: { type: ESTree.TSType | null },
      asserted: ESTree.TSType,
    ): boolean {
      if (broadTypeKind(asserted) !== null) return false;
      // Widening to `unknown`/`any` erases everything, so any narrowing afterwards is a recovery.
      if (broadKind === "top") return true;
      if (
        evidence.type !== null &&
        sourceCode.getText(evidence.type).replaceAll(/\s+/gu, "") ===
          sourceCode.getText(asserted).replaceAll(/\s+/gu, "")
      ) {
        return true;
      }
      return broadKind === "object"
        ? isDefinitelyObjectType(asserted)
        : isDefinitelyNarrowerDictionary(asserted);
    }

    const checkAssertion = (node: TypeAssertion) => {
      if (node.expression.type !== "Identifier") return;
      const variable = resolveVariable(sourceCode, node.expression);
      if (variable === null) return;

      const widened = widenedBinding(variable);
      if (
        widened === null ||
        // The assertion must come after the widening. Without this, a use earlier in the file that
        // happens to share the name reports against a declaration it cannot have read.
        node.start <= widened.declaredAt ||
        functionBoundary(node) !== widened.boundary ||
        !assertionRecoversEvidence(widened.broadKind, widened.evidence, node.typeAnnotation)
      ) {
        return;
      }

      context.report({ node, messageId: "widenThenAssert", data: { name: node.expression.name } });
    };

    return {
      TSAsExpression: checkAssertion,
      TSTypeAssertion: checkAssertion,
    };
  },
});
