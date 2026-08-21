// ADVERSARIAL for `types/no-known-value-widening`, and a separate file because
// its two findings carry the OTHER sentence.
//
// `satisfies` is a fix for the dictionary case and a no-op here: `satisfies
// unknown` compiles, checks nothing, and leaves the loss in place. One message
// delivered to both branches passes every count and path assertion there is, so
// the `absent` entries across this file and `kvw-widened.ts` are the only thing
// standing between the reader and an edit that does nothing.
export const opaqueSettlement: unknown = { id: "s-1" };
export const nonPrimitiveSettlement: object = { id: "s-1" };
