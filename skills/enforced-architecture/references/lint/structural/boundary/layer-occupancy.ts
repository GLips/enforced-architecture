// ─── boundary/layer-occupancy ─────────────────────────────────────────
//
// Makes sure: A feature uses each layer it has. If the feature has a
// controllers directory, every call from ui goes through it. If it has a repo
// directory, all queries to its tables are in that directory. Thus you change
// a layer in one place, and the callers you find are all of the callers.
//
// Occupancy starts the check. To skip a layer that is not there is correct,
// thus this cannot be a static policy. The check tests for occupancy and not
// for a directory. An empty layer stops access to every layer below it and
// gives you no place to put the code.
//
// Do not match "../repo/" in a specifier. The same import from a directory one
// level deeper ("../../repo/x"), or as an alias to the same feature, looks
// correct to a pattern. A person who moves a layer into subfolders writes the
// deeper form.
//
// Type imports count. The result must not change for a type-only import; only
// the words in the message change. If the result changes, "import type"
// becomes the permitted spelling of the same problem.
//
// An import that goes up is placement/layer-direction's finding, not this one's.
// ──────────────────────────────────────────────────────────────────────

import { dbSchemaPath, orderedLayerDirs, withoutSourceExtension } from "../../policy/layout.ts";
import type { Finding, StructuralCheck } from "../check-context.ts";
import type { ImportEdge } from "../import-graph.ts";

export const layerOccupancyCheck: StructuralCheck = {
  id: "boundary/layer-occupancy",
  scope: "tree",

  async run({ vocabulary, importGraph, occupiedDirs }) {
    // Every name here is the tree's, and none of them is a knob of this check's
    // own. A schema path or a layer name configured beside this rule is the
    // vocabulary written twice, and the copy that drifts goes quiet rather than
    // red.
    const schemaTarget = dbSchemaPath(vocabulary);
    const { featuresDir: featuresDirName } = vocabulary;
    const layerOrder = orderedLayerDirs(vocabulary);
    const dataLayer = layerOrder[layerOrder.length - 1];
    const findings: Finding[] = [];

    for (const edge of importGraph()) {
      if (edge.from.kind !== "feature") continue;
      const { feature } = edge.from;

      // A file at a feature root has no layer and no rank. That it sits there at
      // all is `placement/topology`'s finding rather than this one's, and
      // inventing a rank for it is where this check would manufacture findings.
      const fromLayer = edge.from.layer;
      if (fromLayer === undefined) continue;

      const bypass = classifyBypass({
        edge,
        feature,
        fromRank: layerOrder.indexOf(fromLayer),
        layerOrder,
        occupied: occupiedDirs(`${featuresDirName}/${feature}`),
        schemaTarget,
        dataLayer,
      });
      if (bypass === undefined) continue;

      findings.push({
        severity: "error",
        file: edge.file,
        // Passed through undefined when the graph could not place the specifier
        // in the text. This check blocks, so a wrong line sends someone
        // somewhere.
        line: edge.line,
        message:
          (bypass.kind === "schema"
            ? schemaMessage({ edge, feature, featuresDirName, fromLayer, dataLayer: bypass.dataLayer })
            : skipMessage({
                edge,
                feature,
                featuresDirName,
                fromLayer,
                toLayer: bypass.toLayer,
                skipped: bypass.skipped,
              })) + typeNote(edge, fromLayer, importeeName(bypass)),
      });
    }

    return findings;
  },
};

/**
 * Each arm carries the far end's NAME as well as its verdict, because each arm
 * names it for a different reason and neither reason is readable off `edge.to`.
 * The skip arm has already established a layer for the importee and so can
 * name it. The schema arm names the far end for what the arm is ABOUT — its
 * headline is "imports DB schema" — and not for wherever the tables happen to
 * live: `schemaTarget` is free to point inside a layered boundary, and a message
 * that called the far end "repo" there would contradict its own first line.
 */
type Bypass =
  | { kind: "skip"; skipped: string[]; toLayer: string }
  | { kind: "schema"; dataLayer: string };

/** What the far end of the bypass is called, for the type-only note. */
function importeeName(bypass: Bypass): string {
  return bypass.kind === "schema" ? "schema" : bypass.toLayer;
}

/**
 * What this edge reaches past, or undefined when it reaches past nothing this
 * check has an opinion about.
 *
 * The two arms share the occupancy idea and nothing else: one asks which layers
 * lie strictly BETWEEN the endpoints, the other asks whether the lowest layer is
 * staffed at all.
 */
function classifyBypass(input: {
  edge: ImportEdge;
  feature: string;
  /** The importer's position in `layerOrder`. */
  fromRank: number;
  layerOrder: string[];
  occupied: string[];
  schemaTarget: string;
  dataLayer: string;
}): Bypass | undefined {
  const { edge, feature, fromRank, layerOrder, occupied, schemaTarget, dataLayer } = input;

  if (edge.to.kind === "feature" && edge.to.feature === feature) {
    const toLayer = edge.to.layer;
    if (toLayer === undefined) return undefined;
    const toRank = layerOrder.indexOf(toLayer);
    // Upward and sideways edges are not skips, and the SLICE is what excludes
    // them: `fromRank + 1 > toRank` for an upward edge and `fromRank + 1 === toRank`
    // for a sideways one both yield an empty span, so there is no separate direction
    // guard here to keep in step. `placement/layer-direction` reports the upward
    // ones. Both bounds are load-bearing — widening either end by one over-matches
    // an adjacent edge that skips nothing.
    const skipped = layerOrder
      .slice(fromRank + 1, toRank)
      .filter((layer) => occupied.includes(layer));
    return skipped.length === 0 ? undefined : { kind: "skip", skipped, toLayer };
  }

  // Same feature only, for the skip arm. An edge reaching into ANOTHER feature's
  // internals is a feature-boundary question, and `graph/feature-deps` and
  // `api/feature-visibility` already own it — two rules reporting one edge
  // teaches people that one of them is noise. Layers also only rank against each
  // other within one feature: `repo` in alpha and `service` in beta are not two
  // rungs of one ladder.
  //
  // What is left is the schema arm, which is a crossing by construction: the
  // tables live in infrastructure, never inside the feature.
  if (!isUnder(edge.target, schemaTarget)) return undefined;
  // Nothing to reach past. A feature whose lowest layer is empty or absent
  // accesses infrastructure directly and is correct to, which is what stops this
  // demanding three directories before a young feature can read a table — and a
  // file already IN that layer is where the query belongs.
  if (!occupied.includes(dataLayer)) return undefined;
  if (fromRank >= layerOrder.length - 1) return undefined;
  return { kind: "schema", dataLayer };
}

function skipMessage(input: {
  edge: ImportEdge;
  feature: string;
  featuresDirName: string;
  fromLayer: string;
  toLayer: string;
  skipped: string[];
}): string {
  const { edge, feature, featuresDirName, fromLayer, toLayer, skipped } = input;
  // `layerOrder` takes any number of layers, so three skipped ones are reachable
  // the moment a project declares five — and a bare join renders them
  // "a/ and b/ and c/".
  const skippedLayers =
    skipped.length > 1
      ? `${skipped.slice(0, -1).join("/, ")}/ and ${skipped[skipped.length - 1]}`
      : skipped[0];
  return (
    `"${edge.specifier}" bypasses ${skippedLayers}/: ${fromLayer} imports\n` +
    `from ${toLayer} directly, and feature "${feature}" has ${skippedLayers}/ occupied.\n` +
    `Route the call through ${featuresDirName}/${feature}/${skipped[0]}/ instead.\n` +
    `Reaching past a present layer splits its job in two — some calls through it, some\n` +
    `around it — and neither half looks wrong in the file it is written in.`
  );
}

function schemaMessage(input: {
  edge: ImportEdge;
  feature: string;
  featuresDirName: string;
  fromLayer: string;
  dataLayer: string;
}): string {
  const { edge, feature, featuresDirName, fromLayer, dataLayer } = input;
  return (
    `${fromLayer}/ imports DB schema ("${edge.specifier}"),\n` +
    `but feature "${feature}" has a ${dataLayer}/ layer. Move the query into a\n` +
    `function under ${featuresDirName}/${feature}/${dataLayer}/ and call that instead.\n` +
    `The DB client stays legal here — a caller passes it to ${dataLayer} functions for\n` +
    `transaction handling. It is query CONSTRUCTION that has to be concentrated in ${dataLayer}/.`
  );
}

/**
 * The verdict does not branch on `typeOnly` — the WORDING does. A reader who
 * wrote a runtime import does not need the type-import argument, and a blocking
 * message that argues a case the reader is not in is a message they learn to
 * skim.
 */
function typeNote(edge: ImportEdge, fromLayer: string, reached: string): string {
  if (!edge.typeOnly) return "";
  return (
    `\nThis import is type-only, which is the same bypass: naming a ${reached} type\n` +
    `here makes that shape part of what ${fromLayer} is written against, and neither\n` +
    `can be lifted out while that is true.`
  );
}

/**
 * Prefix match on whole path segments, with the extension off.
 *
 * Two independent things are wrong without each half. A plain `startsWith` makes
 * `infrastructure/db/schema-utils.ts` a schema module, and the finding it
 * produces is one nobody can act on. And `schemaTarget` is a POSITION —
 * `infrastructure/db/schema` — which a project is free to fill with either a
 * directory of table modules or one `schema.ts`; the single module is the
 * ordinary Drizzle shape. Compared with the extension on, that project's target
 * is `infrastructure/db/schema.ts`, equal to nothing and under nothing, and this
 * arm goes silent for the whole repo while the directory layout next door still
 * reports.
 */
function isUnder(target: string, prefix: string): boolean {
  const bare = withoutSourceExtension(target);
  return bare === prefix || bare.startsWith(`${prefix}/`);
}
