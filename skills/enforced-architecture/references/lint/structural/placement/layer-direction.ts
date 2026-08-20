// ─── placement/layer-direction ────────────────────────────────────────
//
// Makes sure: Inside one feature, an import only goes down the layer stack, and
// no file in the feature imports the feature's own barrel. You can move a low
// layer to a new feature, or replace it, and read only the layers below it. When
// you change a high layer, no layer below it can break, because no layer below
// it imports it.
//
// Direction is the only question here. A downward edge that skips a layer is
// boundary/layer-occupancy's finding. The two are independent: an edge can be
// wrong under one, both, or neither, and one check that answers both is a check
// nobody can predict.
//
// Do not match "../service/" in a specifier. The same edge from a directory one
// level deeper ("../../service/x"), or as an alias to the same feature, looks
// correct to a pattern. The aliased spelling is what auto-import writes, thus it
// is the most frequent spelling of an upward edge.
//
// Type imports count. A type that goes up inverts the dependency as a value
// does, and you still cannot read the low layer without the high layer.
//
// The barrel arm is here and not in boundary/import-policy. That engine calls
// the edge internal, because both ends are one unit, which is correct for a
// question about imports between units and wrong for direction inside a feature.
// ──────────────────────────────────────────────────────────────────────

import { isUnitBarrel } from "../../policy/layout.ts";
import type { Finding, StructuralCheck } from "../check-substrate.ts";

export const layerDirectionCheck: StructuralCheck = {
  id: "placement/layer-direction",

  run({ config, importGraph }) {
    const { layerOrder } = config.source;
    const root = config.source.roots[0];
    if (root === undefined) return [];

    const findings: Finding[] = [];

    for (const edge of importGraph()) {
      // Layers only rank against each other WITHIN one feature: `repo` in alpha
      // and `service` in beta are not two rungs of one ladder, and comparing
      // them turns every cross-feature edge into a direction verdict.
      const feature = edge.from.feature;
      if (feature === undefined || feature !== edge.to.feature) continue;

      // The feature's own barrel is the one unranked end this check does judge,
      // and it judges it without a rank: it sits above every layer by
      // construction, because it re-exports them.
      //
      // Gated on the SOURCE not being a barrel, rather than on the source having
      // a layer. `features/x/errors.ts` sits in no layer and produces the
      // identical cycle — `index.ts` re-exports it — so a layer guard here reads
      // as "the barrel is safe from the feature root", which it is not. What the
      // guard has to exclude is a barrel importing a barrel: `index.server.ts`
      // re-exporting `index.ts` is explicitly legal, and is the one edge into
      // this barrel that comes from inside the unit and should stay silent.
      const unit = `${config.source.featuresDirName}/${feature}`;
      if (!isUnitBarrel(unit, stripRoot(edge.file, root)) && isUnitBarrel(unit, edge.target)) {
        const inside = edge.from.layer ?? `${feature}'s root`;
        findings.push({
          severity: "error",
          file: edge.file,
          line: edge.line,
          message:
            `"${edge.specifier}" reaches feature "${feature}"'s own barrel from inside it.\n` +
            `The barrel re-exports every layer, so ${inside} importing it depends on\n` +
            `all of them at once — the layers above this one included — and the cycle runs\n` +
            `through the file whose job is to describe the feature from OUTSIDE. Import the\n` +
            `sibling module directly: the barrel is for consumers, not for the feature itself.`,
        });
        continue;
      }

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

/** `src/features/billing/index.ts` -> `features/billing/index.ts`, or the path unchanged. */
function stripRoot(projectPath: string, root: string): string {
  return projectPath.startsWith(`${root}/`) ? projectPath.slice(root.length + 1) : projectPath;
}
