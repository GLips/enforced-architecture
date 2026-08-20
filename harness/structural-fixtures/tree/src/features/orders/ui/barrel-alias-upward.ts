// FIRES layer-direction: the same edge written as the feature's own alias.
//
// This is the spelling a project's own conventions encourage and the one
// auto-import writes, and it carries no `../` for a relative matcher to key on.
// It is also the spelling the structural import-policy check never sees — an
// aliased specifier belongs to the linter — so if this arm did not resolve, the
// edge would be governed by nothing in either tier.
export { placeOrder } from "@/features/orders/index.ts";
