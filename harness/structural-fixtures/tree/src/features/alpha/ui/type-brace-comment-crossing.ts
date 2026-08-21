// FIRES import-policy: an inline `type` member whose clause holds a `}` inside a
// COMMENT. The rewrite pass matched an import clause with `\{[^{}]*\}`, so the
// brace in the comment ended the clause early and the `type` modifier was never
// stripped — the whole edge went missing rather than merely losing its mark.
import { type BetaShape /* } not the end of the clause */ } from "../../beta/service/beta-shape.ts";

export const widthOf = (shape: BetaShape): number => shape.beta.length;
