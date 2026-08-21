// FIRES import-policy: an import written in a TYPE POSITION. No spelling of
// `import type` appears anywhere in this file, so no text rewrite was ever going
// to reach it — this one needs a parser, not a wider regex.
type Shape = import("../../beta/service/beta-shape.ts").BetaShape;

export const beta = (shape: Shape): string => shape.beta;
