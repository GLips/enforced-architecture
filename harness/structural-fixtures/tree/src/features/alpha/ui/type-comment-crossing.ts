// FIRES import-policy: a sibling-feature crossing written as a type-only import
// with a COMMENT between the two keywords. Valid TypeScript, and invisible to
// any pass that recovers type imports by rewriting `import type` in the text —
// `\bimport\s+type\b` does not match across the comment, so the edge reached no
// check at all. A type-only crossing is still denied by direction here; only the
// domain-purity row reads `typeOnly`.
import /* keep the shape out of the bundle */ type { BetaShape } from "../../beta/service/beta-shape.ts";

export const describeBeta = (shape: BetaShape): string => shape.beta;
