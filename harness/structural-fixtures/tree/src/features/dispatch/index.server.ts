// LEGAL: the SERVER barrel, and the one `courier` actually imports.
//
// `api/barrel-purity` excludes index.server from its trace, and `layout.ts`
// calls it a second public surface — a check written from either of those
// could reasonably decide server barrels are a different kind of edge and stop
// asking for a grant. This barrel is where that decision would show.
export { dispatchPlanVersion } from "./service/dispatch-plan.ts";
