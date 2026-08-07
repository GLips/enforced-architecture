// LEGAL: an edge with a layer on one end only. `../errors.ts` sits at the
// feature root, which is in no layer at all, so there is no direction to be
// wrong about and this must stay silent.
//
// It is the fixture for the rank an absent layer gets by accident. Looking the
// layer up with `indexOf` hands an undefined layer -1 — above every real layer
// — and every import of a feature-root file becomes an upward edge. Treating it
// as index 0 puts it at the top instead, which fires the moment the importer is
// below ui. Whether a file belongs at a feature root is structure/topology's
// finding, and never this one's.
export { LayersError } from "../errors.ts";
