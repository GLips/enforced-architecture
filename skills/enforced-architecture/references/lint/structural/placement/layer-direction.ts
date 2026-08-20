// ─── placement/layer-direction ────────────────────────────────────────
//
// Tag:       placement
// Mechanism: structural script (resolution across the tree)
// Blocking:  Yes
//
// Prevents:  A lower layer importing from a higher one inside the same feature.
//            The layer stack is the feature's only statement about which way
//            dependency runs; an upward edge makes the two layers one module
//            that happens to be spread across two directories, and every later
//            extraction has to unpick it.
//
// Direction is the ONLY question here. A downward edge that skips a layer is
// `boundary/layer-occupancy`'s finding, not this one — the two get conflated,
// and a check answering both is a check nobody can predict.
//
// See placement/layer-direction.md for the negative space and the adapt notes,
// and graph/import-graph.md for how an edge gets resolved at all.
//
// ──────────────────────────────────────────────────────────────────────

import type { Finding, StructuralCheck } from "../lib.ts";

export const layerDirectionCheck: StructuralCheck = {
  id: "placement/layer-direction",

  run({ config, importGraph }) {
    const { layerOrder } = config.source;
    const findings: Finding[] = [];

    for (const edge of importGraph()) {
      // Layers only rank against each other WITHIN one feature: `repo` in alpha
      // and `service` in beta are not two rungs of one ladder, and comparing
      // them turns every cross-feature edge into a direction verdict.
      if (edge.from.feature === undefined || edge.from.feature !== edge.to.feature) continue;

      // An end with no layer has no rank, and inventing one for it is where this
      // check manufactures findings — an absent layer sorts either above
      // everything or below it, depending on the accident of how it is spelled.
      // A file at a feature root genuinely has no layer, and that it sits there
      // at all is `placement/topology`'s finding rather than this one's.
      if (edge.from.layer === undefined || edge.to.layer === undefined) continue;

      // Both are in `layerOrder` by construction: the graph assigns a layer only
      // when the segment names one.
      if (layerOrder.indexOf(edge.to.layer) >= layerOrder.indexOf(edge.from.layer)) continue;

      findings.push({
        severity: "error",
        file: edge.file,
        // Undefined for a specifier the graph could not place in the text, and
        // passed through as such. A wrong line on a blocking check sends someone
        // to the wrong place, which is worse than sending them to the file.
        line: edge.line,
        message:
          `"${edge.specifier}" runs upward: ${edge.from.layer} imports from ${edge.to.layer}.\n` +
          `Direction is ${layerOrder.join(" -> ")}, highest to lowest, and an import may\n` +
          `only run down it. Move what both layers need down into ${edge.from.layer}, or out\n` +
          `to a domain, or invert the call so ${edge.to.layer} drives ${edge.from.layer}.\n` +
          `Downward imports are the normal direction and stay unreported.`,
      });
    }

    return findings;
  },
};
