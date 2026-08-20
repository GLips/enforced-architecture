// ─── boundary/layer-occupancy ─────────────────────────────────────────
//
// Tag:       boundary
// Mechanism: structural check (resolution across the tree + directory presence)
// Blocking:  Yes
//
// Prevents:  A same-feature import reaching past a layer the feature ALREADY
//            HAS. A feature can carry a well-organised service/ while its UI
//            calls the repo, or a well-organised controllers/ while its UI calls
//            the service, so the layers exist on disk and hold nothing.
//
// The filesystem decides whether there is a question to ask at all. Skipping an
// ABSENT layer is correct — a feature with no service is a feature that did not
// need one — so what makes an edge a bypass is not its length but whether the
// layers it jumps over are occupied. That is why presence is tested rather than
// assumed, and why this cannot be a static policy: it depends on which
// directories exist today.
//
// Occupancy rather than a bare directory test, because an empty leftover layer
// would otherwise revoke access to everything below it while offering nowhere to
// put the code — the fix the message names would be a directory holding nothing.
//
// Presence decides WHETHER to ask; the resolved graph decides WHAT the edge is.
// Never match `../repo/` in a specifier: the same bypass written from a nested
// directory (`../../repo/x`) or as a same-feature alias
// (`@/features/<self>/repo/x`) is ordinary-looking code that a pattern reports
// as clean.
//
// TYPE IMPORTS COUNT, with no exception and no branch. The rule of thumb applied
// per invariant: a check protecting BEHAVIOUR or the bundle exempts them, since
// a type cannot make a verdict depend on env; a check protecting KNOWLEDGE
// exempts nothing. This is the second kind. If ui/ names a type owned by
// service/, the service's shape is part of the UI's contract — change the return
// type and the UI breaks, and neither layer can be lifted out, which is the
// stated reason the layers exist. Counting only runtime edges would weaken
// "never bypass an occupied layer" into "never EXECUTE THROUGH a bypass", and
// `import type` would become the way to bind UI straight to a repo contract with
// the controller layer sitting right there.
//
// This is the line `placement/layer-direction` does NOT hold: it rejects UPWARD
// imports and sees no downward skip at all. A downward edge that skips a layer
// is this check's finding; a direction verdict is that one's. A check answering
// both is a check nobody can predict.
//
// ── The schema arm ────────────────────────────────────────────────────
//
// The DB schema is not a layer, so a schema import is not a skip the slice below
// can see — and it is the same failure. Once a feature's lowest layer is
// occupied, query CONSTRUCTION belongs there, and anything above it assembling
// its own query has reached past that layer to the tables themselves. The DB
// CLIENT stays legal, permanently: the client conveys EXECUTION and the
// transaction boundary is genuinely the caller's — see the doc.
//
// A second arm rather than a wider slice, because the ADVICE differs. A layer
// skip is fixed by routing through the next hop DOWN; a schema import is fixed
// by moving the query all the way into the lowest layer. One message covering
// both would name the wrong destination for one of them.
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// `source.layerOrder` and what is on disk are the whole layer policy. No layer
// is named here by role — the lowest is found by POSITION, which is what
// `layerOrder` already means everywhere else — so a project that adds a fifth
// layer or renames `service/` to `usecases/` gets it covered by naming it once
// in `policy/layout.ts`. What stays configurable is `schemaTarget`, which is not
// a layer at all.
//
// ──────────────────────────────────────────────────────────────────────

import type { Finding, StructuralCheck } from "../check-substrate.ts";
import type { ImportEdge } from "../import-graph.ts";

export const layerOccupancyCheck: StructuralCheck = {
  id: "boundary/layer-occupancy",

  run({ config, importGraph, occupiedDirs }) {
    const { schemaTarget } = config.checks["boundary/layer-occupancy"];
    const { featuresDirName, layerOrder } = config.source;
    const dataLayer = layerOrder[layerOrder.length - 1];
    const findings: Finding[] = [];

    for (const edge of importGraph()) {
      const feature = edge.from.feature;
      if (feature === undefined) continue;

      // A file at a feature root has no layer and no rank. That it sits there at
      // all is `placement/topology`'s finding rather than this one's, and
      // inventing a rank for it is where this check would manufacture findings.
      const fromLayer = edge.from.layer;
      if (fromLayer === undefined) continue;

      const bypass = classifyBypass({
        edge,
        feature,
        from: layerOrder.indexOf(fromLayer),
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
            ? schemaMessage(edge, feature, featuresDirName, bypass.dataLayer)
            : skipMessage(edge, feature, featuresDirName, bypass.skipped)) + typeNote(edge),
      });
    }

    return findings;
  },
};

type Bypass = { kind: "skip"; skipped: string[] } | { kind: "schema"; dataLayer: string };

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
  from: number;
  layerOrder: string[];
  occupied: string[];
  schemaTarget: string;
  dataLayer: string | undefined;
}): Bypass | undefined {
  const { edge, feature, from, layerOrder, occupied, schemaTarget, dataLayer } = input;

  if (edge.to.feature === feature) {
    if (edge.to.layer === undefined) return undefined;
    const to = layerOrder.indexOf(edge.to.layer);
    // Upward and sideways edges are not skips. `placement/layer-direction`
    // reports the upward ones.
    if (to <= from) return undefined;
    const skipped = layerOrder.slice(from + 1, to).filter((layer) => occupied.includes(layer));
    return skipped.length === 0 ? undefined : { kind: "skip", skipped };
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
  if (dataLayer === undefined || !occupied.includes(dataLayer)) return undefined;
  if (from >= layerOrder.length - 1) return undefined;
  return { kind: "schema", dataLayer };
}

function skipMessage(
  edge: ImportEdge,
  feature: string,
  featuresDirName: string,
  skipped: string[],
): string {
  const skippedLayers = skipped.join("/ and ");
  return (
    `"${edge.specifier}" bypasses ${skippedLayers}/: ${edge.from.layer} imports\n` +
    `from ${edge.to.layer} directly, and feature "${feature}" has ${skippedLayers}/ occupied.\n` +
    `Route the call through ${featuresDirName}/${feature}/${skipped[0]}/ instead.\n` +
    `Reaching past a present layer splits its job in two — some calls through it, some\n` +
    `around it — and neither half looks wrong in the file it is written in.`
  );
}

function schemaMessage(
  edge: ImportEdge,
  feature: string,
  featuresDirName: string,
  dataLayer: string,
): string {
  return (
    `${edge.from.layer}/ imports DB schema ("${edge.specifier}"),\n` +
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
function typeNote(edge: ImportEdge): string {
  if (!edge.typeOnly) return "";
  const named = edge.to.layer ?? "schema";
  return (
    `\nThis import is type-only, which is the same bypass: naming a ${named} type\n` +
    `here makes that shape part of what ${edge.from.layer} is written against, and neither\n` +
    `can be lifted out while that is true.`
  );
}

/**
 * Prefix match on whole path segments. A plain `startsWith` makes
 * `infrastructure/db/schema-utils.ts` a schema module, and the finding it
 * produces is one nobody can act on.
 */
function isUnder(target: string, prefix: string): boolean {
  return target === prefix || target.startsWith(`${prefix}/`);
}
