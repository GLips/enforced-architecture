// LEGAL: one component, plus three exports that a name-only test would count as
// components. Silent.
//
// Every one of these was a real false positive at some point, or would have
// been: a PascalCase const is very often not a component. The check has to test
// the VALUE — an arrow, a function expression, forwardRef or memo — and not the
// capital letter. Reporting a context or a constant is what teaches people the
// rule is noise.
import { createContext } from "react";

export const AlphaCtx = createContext<string | null>(null);

export const DRAG_SLOP = 4;

export type AlphaShape = { id: string };

export function AlphaPanel() {
  return <div>alpha</div>;
}
