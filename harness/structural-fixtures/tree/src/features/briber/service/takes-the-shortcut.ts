// FIRES feature-visibility, and fires because bribed/visibility.json is REJECTED
// WHOLE rather than this entry being honoured.
//
// An empty justification is the grant nobody had to think about, and it is the
// shape an agent writes when it wants the edge and not the argument: the JSON is
// bookkeeping, the sentence is the deliverable. Honour the entry and this import
// is granted, so the check falls silent — which is why the case has to be an
// import that WOULD otherwise pass. A fixture with an empty grant and no
// matching edge proves nothing: the file is reported either way, as malformed or
// as a stale grant, and the two are indistinguishable from the finding count.
import { rateCard } from "@/features/bribed/index.ts";

export const tier = rateCard.tier;
