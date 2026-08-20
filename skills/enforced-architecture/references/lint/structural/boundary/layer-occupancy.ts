// ─── boundary/layer-occupancy ─────────────────────────────────────────
//
// Tag:       boundary
// Mechanism: structural script (resolution across the tree + directory presence)
// Blocking:  Yes
//
// Prevents:  A controller reaching past a layer the feature ALREADY HAS. A
//            feature can carry a well-organised service/ and repo/ while its
//            controllers quietly build queries themselves and call repo
//            functions directly, so the layers exist on disk and hold nothing.
//
// Two questions, and the filesystem decides which of them get asked: repo/
// present revokes the controller→schema shortcut, and service/ alongside it
// revokes the controller→repo shortcut. A feature with neither accesses
// infrastructure directly and is not this check's business — which is why
// presence is tested rather than assumed.
//
// Presence decides WHETHER to ask; the resolved graph decides WHAT the edge is.
// Never match `../repo/` in a specifier: the same bypass written from a nested
// controller (`../../repo/x`) or as a same-feature alias
// (`@/features/<self>/repo/x`) is ordinary-looking code that a pattern reports
// as clean.
//
// See boundary/layer-occupancy.md for why the DB client is legal here while the
// schema is not, and for the line this does NOT hold — `structure/layer-
// direction` rejects UPWARD imports and sees no downward skip at all.
//
// ──────────────────────────────────────────────────────────────────────

import type { Finding, StructuralCheck } from "../lib.ts";

export const layerOccupancyCheck: StructuralCheck = {
  id: "boundary/layer-occupancy",

  run({ config, importGraph, occupiedDirs }) {
    const { schemaTarget, repoLayer, serviceLayer, controllerLayer } =
      config.checks["boundary/layer-occupancy"];
    const { featuresDirName } = config.source;

    // Occupancy rather than a bare directory test, and the same helper every
    // other consumer uses: an empty leftover `repo/` otherwise revokes the
    // controller's schema access while offering nowhere to put the query.
    const layersByFeature = new Map(
      occupiedDirs(featuresDirName).map((feature) => [
        feature,
        occupiedDirs(`${featuresDirName}/${feature}`),
      ]),
    );

    const findings: Finding[] = [];

    for (const edge of importGraph()) {
      const feature = edge.from.feature;
      if (feature === undefined || edge.from.layer !== controllerLayer) continue;
      // A type import compiles away, so it couples nothing at runtime and
      // routing it through a layer would buy nothing.
      if (edge.typeOnly) continue;

      const layers = layersByFeature.get(feature) ?? [];
      const hasRepo = layers.includes(repoLayer);
      const hasService = layers.includes(serviceLayer);
      if (!hasRepo && !hasService) continue;

      if (hasRepo && isUnder(edge.target, schemaTarget)) {
        findings.push({
          severity: "error",
          file: edge.file,
          // Passed through undefined when the graph could not place the
          // specifier in the text. This check blocks, so a wrong line sends
          // someone somewhere.
          line: edge.line,
          message:
            `Controller imports DB schema ("${edge.specifier}"),\n` +
            `but feature "${feature}" has a ${repoLayer}/ layer. Move the query into a\n` +
            `function under ${featuresDirName}/${feature}/${repoLayer}/ and call that instead.\n` +
            `The DB client stays legal here — controllers pass it to ${repoLayer} functions for\n` +
            `transaction handling. It is query CONSTRUCTION that has to be concentrated in ${repoLayer}/.`,
        });
      }

      // Same feature only. A controller reaching into ANOTHER feature's repo is
      // a feature-boundary question, and `graph/feature-deps` and
      // `api/feature-visibility` already own it — two rules reporting one edge
      // teaches people that one of them is noise.
      if (hasRepo && hasService && edge.to.feature === feature && edge.to.layer === repoLayer) {
        findings.push({
          severity: "error",
          file: edge.file,
          line: edge.line,
          message:
            `Controller imports ${repoLayer}/ directly ("${edge.specifier}"),\n` +
            `but feature "${feature}" has a ${serviceLayer}/ layer. Route the call through\n` +
            `${featuresDirName}/${feature}/${serviceLayer}/ instead.\n` +
            `Reaching past a present ${serviceLayer}/ splits orchestration in two — some calls\n` +
            `through it, some around it — and neither half looks wrong in the file it is written in.`,
        });
      }
    }

    return findings;
  },
};

/**
 * Prefix match on whole path segments. A plain `startsWith` makes
 * `infrastructure/db/schema-utils.ts` a schema module, and the finding it
 * produces is one nobody can act on.
 */
function isUnder(target: string, prefix: string): boolean {
  return target === prefix || target.startsWith(`${prefix}/`);
}
