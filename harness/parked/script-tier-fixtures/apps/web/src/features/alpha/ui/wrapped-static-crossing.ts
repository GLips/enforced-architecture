// FIRES cross-boundary-alias twice: a wrapped static `from` and a wrapped
// re-export `from`. Goes quiet if extraction reads one line at a time.
import { betaThing } from
  "../../beta/service/beta-thing.ts";

export {
  betaThing as reExported,
} from
  "../../beta/service/beta-thing.ts";

export const wrappedStatic = betaThing;
