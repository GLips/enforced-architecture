// FIRES import-policy: a crossing between a backtick in a quoted string and
// the next real template. Goes quiet if extraction pairs delimiters by pattern,
// which swallows the span between them. The import must be a real crossing — a
// legal one is lost just the same and the suite stays green.
export const TIP = "wrap it in a ` to render as code";

import { betaThing } from "../../beta/service/beta-thing.ts";

export const RENDERED = `beta: ${betaThing}`;
