// LEGAL: a barrel doing everything right. Silent.
//
// Every name it exposes is written out and identical to its definition, which is
// the shape the rule asks for. Reporting it would say the correct barrel is the
// defect, and that is how a blocking check gets switched off.
//
// The `sameName as sameName` line is the over-match guard. It is an alias clause
// whose two sides are the same name, so a matcher that finds `X as Y` and never
// compares them reports it — and no firing fixture can tell, because
// over-matching is invisible to every positive case.
//
// The line below is the second guard: a wildcard written in a comment, on one
// line so it is a complete statement to any matcher run over the raw text.
// export * from "./service/surface-labels.ts"
export { labelFor, slugFor } from "./service/surface-labels.ts";
export { sameName as sameName } from "./service/surface-labels.ts";
export type { SurfaceLabel } from "./service/surface-labels.ts";

// The third guard: a rename written inside a STRING, which a comment-blanking
// pass leaves standing and any matcher over the raw text then reports. Nothing
// is exported here but `RENAME_EXAMPLE`, whose two names are the same one.
export const RENAME_EXAMPLE = 'export { labelFor as surfaceLabelFor } from "./service/surface-labels.ts"';
