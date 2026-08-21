// ─── types/no-widen-then-assert ──────────────────────────────────────
//
// Makes sure: A value with a known type keeps that type to the end of the
// function. No step assigns it to `unknown`, `object` or an open `Record` and
// then asserts the type back with nothing checked between the two. So when you
// change a field on `User`, the compiler reports each use; the two steps cannot
// hold the old type in place.
//
// A bare call is not evidence of a known type. `const x: unknown = parse(text)`
// is a boundary, and the assertion after it is a parse problem, not this one.
// Follow call return types and the rule reports at every boundary in the file.
//
// `types/require-safety-comment` does not cover this flow. It fires on the same
// line, and the compliant answer is `// SAFETY: stored came from loaded, which
// is a User` — a true sentence that keeps both steps and silences the linter
// for good. Take the safety rule alone and prose becomes the cheapest fix.
//
// Both steps must sit in the same function. Across a closure the two lines have
// different authors, and a per-file rule cannot call the flow pointless.
//
// What counts as an open dictionary is `lib/type-annotations.ts`'s answer, not
// this rule's, so it cannot drift from `types/no-opaque-record` on which
// spellings are bags or on `object` as a value.
//
// The two are still not interchangeable, and the gap is this rule's. It reads a
// whole annotation, so it sees a bag only where one is written out:
// `Partial<Record<string, unknown>>`, `Readonly<Record<…>>` and an INTERFACE
// carrying an index signature are all silent here. Nothing is lost, because
// `types/no-opaque-record` reports the inner `Record` or index signature at its
// declaration, so none of those types can exist inside a declared tree to be
// widened through. That backstop is what makes the silence safe; it is not
// coverage on its own.
//
// `types/no-known-value-widening` reads only the KEY half of that shared answer,
// which is why `Record<string, Handler>` reports there and is silent here: a
// dictionary with a precise value type is evidence of a known type, not a
// widening.
//
// Do not add code to unwrap parentheses. oxlint 1.77.0 surfaces neither
// ParenthesizedExpression nor TSParenthesizedType, so `(value) as (User)`
// arrives as the bare nodes. The spec pins the parenthesized spelling, so the
// test fails if a later version surfaces them.
//
// SCOPE, and it is the same for every TREE-SCOPED rule in this catalog — which
// is every rule but `testing/no-module-mocking`, whose subject is a test file and
// which is therefore enabled globally. This rule is silent outside the declared
// trees, and silent on the files `isArchitectureExemptSourcePath` names inside
// them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { type ESTree, type Scope, type SourceCode, type Variable } from "@oxlint/plugins";
import {
  collectLocalTypeFacts,
  dictionaryShape,
  isOpaqueDictionaryValue,
  type LocalTypeFacts,
  openDictionaryValueType,
} from "../lib/type-annotations.ts";

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
// always a loss. A CallExpression is absent on purpose: a call's return type is not visible
// here, so an annotation over it can add information rather than subtract it.
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

function isTopType(type: ESTree.TSType): boolean {
  return type.type === "TSUnknownKeyword" || type.type === "TSAnyKeyword";
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

export const noWidenThenAssertRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      widenThenAssert:
        "`{{name}}` had a known type, discarded it, and this assertion invents it back. Nothing was checked in between. Delete the widening and keep the original type through to here.",
    },
  },
  create(context) {

    const sourceCode = context.sourceCode;
    let facts: LocalTypeFacts = {
      aliases: new Map(),
      enums: new Set(),
      constAsserted: new Set(),
      visitorKeys: sourceCode.visitorKeys,
    };

    // `lib/type-annotations.ts` owns what an open dictionary is, so this rule and
    // `types/no-opaque-record` cannot disagree about which spellings are bags — both halves,
    // the key domain and the opaque value.
    function isOpenOpaqueDictionary(type: ESTree.TSType): boolean {
      const value = openDictionaryValueType(type, facts);
      return value !== null && isOpaqueDictionaryValue(value, facts);
    }

    function broadTypeKind(type: ESTree.TSType): BroadKind | null {
      if (isTopType(type)) return "top";
      if (type.type === "TSObjectKeyword") return "object";
      return isOpenOpaqueDictionary(type) ? "record" : null;
    }

    // Whether the assertion target says more than the widening did.
    //
    // Only reached once `broadTypeKind(type)` is null, and that is what makes this as short as it
    // is: a dictionary arriving here has ALREADY failed to be an open one with an opaque value, so
    // it closed its keys, named its value type, or both. Either is a recovery. Re-asking the
    // opaque-value question here would be asking a question already answered — and re-asking the
    // OPEN-key one would call `Record<'draft' | 'paid', Handler>` not-a-dictionary and drop the
    // report, which is the flow this rule exists for.
    //
    // Reads the dictionary through the same owner as the widening side. Matching `Record` by name
    // here instead leaves the recovery half blind to the mapped-type and local-alias spellings —
    // the same drift on the other end of one rule, and one keystroke from suppressing the report.
    function isDefinitelyNarrowerDictionary(type: ESTree.TSType): boolean {
      if (dictionaryShape(type, facts) !== null) return true;
      // Not a dictionary at all: a literal that names any member is a shape, which says strictly
      // more than the bag the value was widened to.
      return (
        type.type === "TSTypeLiteral" &&
        type.members.some((member) => member.type !== "TSIndexSignature")
      );
    }

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
      // Collected up front: a type alias is routinely declared below the function that widens
      // through it, and a widening spelled `const stored: Bag = user` reads nothing without it.
      Program(node) {
        facts = collectLocalTypeFacts(node, sourceCode.visitorKeys);
      },
      TSAsExpression: checkAssertion,
      TSTypeAssertion: checkAssertion,
    };
  },
});
