// What a parameter BINDS and what it is annotated with, seen through the wrappers that carry
// either one. `react/prop-count` is the only reader.
//
// The one question here is the one that is genuinely syntactic: which node holds the annotation.
// What an annotation MEANS — does it resolve to a broad type, is a signature a type guard, is a
// type an open dictionary — belongs to `structural/types/type-shapes.ts`, where a checker answers
// each in one call instead of hundreds of lines of syntax enumerating spellings.
//
// So nothing here reads `unknown`/`any`, and nothing should start. A rule in this tier that needs
// to know what a type MEANS belongs in the structural tier; one that adds a second syntactic
// approximation here is the near-copy this catalog keeps producing.

import type { ESTree } from "@oxlint/plugins";

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
