// The per-tree VOCABULARY fixture, and the other half of the probe.
//
// `capabilities/` is this tree's features directory. Read with this tree's
// vocabulary the path is a feature's ui layer and legal; read with the app
// tree's vocabulary `capabilities` is not a top-level directory at all and
// `placement/topology` would report it. A finding here means a declared tree was
// resolved against the wrong tree's names.
export const renderPage = (): string => "page";
