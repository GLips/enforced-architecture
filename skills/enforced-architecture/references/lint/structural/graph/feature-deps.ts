// ─── graph/feature-deps ───────────────────────────────────────────────
//
// Makes sure: No feature imports a feature that imports it back, at any depth.
// You can delete one feature, or move it into its own package, and change only
// the code that imports it. You do not have to edit two features together to
// make one change.
//
// The check reads the two resolved ends of each edge, never the specifier text.
// Do not match "@/features/<name>". People also write these imports as relative
// paths, and the check then does not see a cycle that it exists to find.
//
// Type-only edges count. A type that crosses a feature boundary makes the two
// features dependent: the importee cannot change the type unless the importer
// changes too.
//
// No entry in visibility.json makes a cycle legal, so do not add a way to grant
// one. The fix for a cycle is to move the shared code to domains/ or shared/.
//
// Cycles fail the run. The three coupling thresholds give warnings only, because
// the correct number changes with the size of the project. Do not make them
// errors before you set each one above the current count. A check that reports
// the project in its current state is a check the team disables. The cycle
// errors then stop with it.
//
// This check has no mode that only prints the edge set. A check returns findings
// and the orchestrator owns every mode; add a baseline report there, over the
// same graph.
// ──────────────────────────────────────────────────────────────────────

import type { Finding, StructuralCheck } from "../check-substrate.ts";

export const featureDepsCheck: StructuralCheck = {
  id: "graph/feature-deps",

  run({ config, importGraph, occupiedDirs }) {
    const { totalEdgeThreshold, pairSaturationThreshold, fanOutThreshold } =
      config.checks["graph/feature-deps"];
    const { featuresDirName } = config.source;
    const featuresPath = `${config.source.roots[0]}/${featuresDirName}`;

    // Directories holding at least one source file. An empty leftover directory
    // otherwise manufactures a subject, and the check reports a passing result
    // over a set it never really had.
    const features = occupiedDirs(featuresDirName);
    if (features.length < 2) return [];

    // Deduplicated per file: a file importing the same feature twice still
    // creates one edge, but the FILE COUNT per edge is what pair saturation
    // measures, so the importing files are kept rather than just a tally.
    const importersByEdge = new Map<string, Set<string>>();
    for (const edge of importGraph()) {
      if (edge.from.kind !== "feature" || edge.to.kind !== "feature") continue;
      const importer = edge.from.feature;
      const importee = edge.to.feature;
      if (importer === importee) continue;
      const key = `${importer}\0${importee}`;
      importersByEdge.set(key, (importersByEdge.get(key) ?? new Set()).add(edge.file));
    }

    const targetsOf = new Map<string, Set<string>>(features.map((name) => [name, new Set()]));
    for (const key of importersByEdge.keys()) {
      const [importer = "", importee = ""] = key.split("\0");
      targetsOf.get(importer)?.add(importee);
    }

    const findings: Finding[] = [];

    for (const cycle of stronglyConnectedComponents(features, targetsOf)) {
      const members = [...cycle].sort();
      const edges = members
        .flatMap((from) => members.filter((to) => targetsOf.get(from)?.has(to)).map((to) => `${from} -> ${to}`))
        .join(", ");
      findings.push({
        severity: "error",
        // Filed against the alphabetically first participant, so one cycle
        // reports at one stable address run to run.
        file: `${featuresPath}/${members[0]}`,
        message:
          `Feature dependency cycle: ${members.join(" <-> ")}.\n` +
          `Edges forming it: ${edges}.\n` +
          `Neither feature can evolve independently while this cycle exists. Extract the\n` +
          `shared concern to domains/ (business logic) or shared/ (utilities and UI).\n` +
          `A visibility grant does not buy this back — declaring both directions only\n` +
          `writes the cycle down.`,
      });
    }

    if (importersByEdge.size > totalEdgeThreshold) {
      findings.push({
        severity: "warning",
        file: featuresPath,
        message:
          `Total cross-feature edges (${importersByEdge.size}) exceeds threshold (${totalEdgeThreshold}).\n` +
          `The feature graph is becoming a web rather than a tree. Extract shared logic to\n` +
          `domains/ or shared/ to reduce coupling.`,
      });
    }

    for (const [key, files] of [...importersByEdge].sort(([a], [b]) => a.localeCompare(b))) {
      if (files.size <= pairSaturationThreshold) continue;
      const [importer = "", importee = ""] = key.split("\0");
      findings.push({
        severity: "warning",
        file: `${featuresPath}/${importer}`,
        message:
          `Pair saturation: ${importer} -> ${importee} is imported from ${files.size} files ` +
          `(threshold: ${pairSaturationThreshold}).\n` +
          `This dependency is pervasive, not incidental. Extract the shared concern to\n` +
          `domains/ or shared/.`,
      });
    }

    for (const feature of features) {
      const targets = [...(targetsOf.get(feature) ?? [])].sort();
      if (targets.length <= fanOutThreshold) continue;
      findings.push({
        severity: "warning",
        file: `${featuresPath}/${feature}`,
        message:
          `Fan-out: "${feature}" imports from ${targets.length} other features ` +
          `(threshold: ${fanOutThreshold}).\n` +
          `Targets: ${targets.join(", ")}.\n` +
          `Consider whether shared logic should be extracted to domains/ or shared/.`,
      });
    }

    return findings;
  },
};

/**
 * Tarjan's, so every independent cycle surfaces in ONE pass rather than one per
 * run — a project fixing the cycle a naive search reported only to meet the next
 * one on the following commit learns that the check is a queue rather than an
 * answer. Components of size 1 are not cycles and are dropped.
 *
 * Recursive because feature graphs run well under 20 nodes; the depth is bounded
 * by the number of features.
 */
function stronglyConnectedComponents(
  nodes: string[],
  targetsOf: Map<string, Set<string>>,
): string[][] {
  const index = new Map<string, number>();
  const lowLink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];
  let next = 0;

  function visit(node: string): void {
    index.set(node, next);
    lowLink.set(node, next);
    next += 1;
    stack.push(node);
    onStack.add(node);

    for (const target of targetsOf.get(node) ?? []) {
      if (!index.has(target)) {
        visit(target);
        lowLink.set(node, Math.min(lowLink.get(node) ?? 0, lowLink.get(target) ?? 0));
      } else if (onStack.has(target)) {
        lowLink.set(node, Math.min(lowLink.get(node) ?? 0, index.get(target) ?? 0));
      }
    }

    if (lowLink.get(node) !== index.get(node)) return;
    const component: string[] = [];
    for (;;) {
      const member = stack.pop();
      if (member === undefined) break;
      onStack.delete(member);
      component.push(member);
      if (member === node) break;
    }
    if (component.length > 1) components.push(component);
  }

  for (const node of nodes) if (!index.has(node)) visit(node);
  return components;
}
