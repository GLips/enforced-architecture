// LEGAL: a file at the feature root. It is in NO layer — `errors.ts` is not a
// layer name — and it exists to be imported by ui/layerless-neighbour.ts, which
// is where the absent layer has to stay silent.
//
// Nothing else in this tree gives an edge with a layer on one end only, so
// deleting this file deletes that coverage rather than failing a comparison.
export class LayersError extends Error {}
