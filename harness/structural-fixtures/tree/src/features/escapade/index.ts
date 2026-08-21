// FIRES barrel-purity: the chain's hop is a static IMPORT spelled with a unicode
// escape. A scanner handing the resolver the source text instead of the parser's
// cooked value resolves nothing here, the trace stops at this barrel, and the
// reachable `stripe` below goes unreported — with every other fixture green.
import { chargeOnce } from "./service/charg\u0065.ts";

export const charge = (): string => chargeOnce();
