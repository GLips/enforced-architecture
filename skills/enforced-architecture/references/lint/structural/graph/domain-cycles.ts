// ─── graph/domain-cycles ──────────────────────────────────────────────
//
// Makes sure: No domain depends on a domain that depends on it back, at any
// depth. You can move one domain into its own package, or delete it, and
// change only the code above it. You can test one domain with only the
// domains below it.
//
// The check reads the two resolved ends of each edge, never the specifier.
// Do not give it the alias prefix, and do not let it assume that
// boundary/import-policy removes the relative form first. People also write
// these imports relatively, and a missing edge makes no finding, thus the
// check reports clean.
//
// Type-only edges count. The graph marks them and this check ignores the
// mark. With a circular type dependency you must still change both domains
// at the same time.
//
// The check says nothing about which edges are correct. A layered domain
// graph, such as pricing -> catalog, is normal and gets no finding. A check
// that reports layered domains is one that people disable.
//
// Coverage is the graph's coverage. If this check does not see an import,
// change the extractor in import-graph.ts. A specifier match here gives two
// checks two different sets of imports under one stated scope.
// ──────────────────────────────────────────────────────────────────────

import { describeEdgeLine, type ImportEdge } from "../import-graph.ts";
import type { Finding, StructuralCheck } from "../check-substrate.ts";

/** One domain→domain dependency, and the earliest import that establishes it. */
type DomainDependency = { from: string; to: string; witness: ImportEdge };

export const domainCyclesCheck: StructuralCheck = {
  id: "graph/domain-cycles",

  run({ config, importGraph, occupiedDirs }) {
    const { domainsDirName, roots } = config.source;

    // Occupancy rather than directory presence. An empty leftover directory
    // otherwise manufactures a domain, and this check then reports a passing
    // result over a set it never really had. One domain cannot form a cycle
    // with itself here — a within-domain import stays inside one boundary — so
    // fewer than two occupied domains means there is no subject at all.
    if (occupiedDirs(domainsDirName).length < 2) return [];

    const dependencies = new Map<string, Set<string>>();
    const dependencyByDomainPair = new Map<string, DomainDependency>();

    for (const edge of importGraph()) {
      if (edge.from.kind !== "domain" || edge.to.kind !== "domain") continue;
      const from = edge.from.domain;
      const to = edge.to.domain;
      // The two ends must be DIFFERENT domains. A hop inside one domain is how a
      // module moves within itself and is not an edge in this graph at all.
      // Counted as one it cannot invent a cycle — the component pass below needs
      // two members — but it does put "x -> x" in the trail of a cycle the domain
      // is genuinely in, which sends the reader to an import that is not part of
      // the ring and cannot be cut from it.
      if (from === to) continue;

      const pair = `${from}\0${to}`;
      dependencies.set(from, (dependencies.get(from) ?? new Set()).add(to));
      // First occurrence wins, and the graph hands edges over in file order, so
      // the witness a finding names is the earliest place the dependency is
      // written rather than an arbitrary one of a dozen identical imports.
      if (!dependencyByDomainPair.has(pair)) {
        dependencyByDomainPair.set(pair, { from, to, witness: edge });
      }
    }

    const domainsPath = `${roots[0]}/${domainsDirName}`;
    const findings: Finding[] = [];

    for (const cycle of stronglyConnectedDomains(dependencies)) {
      const members = new Set(cycle);
      // Every edge INSIDE the component, not one path around it. A component can
      // be woven several ways, and naming one arbitrary lap leaves the reader
      // hunting for the imports it did not mention.
      const trail = [...dependencyByDomainPair.values()]
        .filter(({ from, to }) => members.has(from) && members.has(to))
        .map(
          ({ from, to, witness }) =>
            `  ${from} -> ${to}: ${witness.file}${describeEdgeLine(witness)} ` +
            `imports "${witness.specifier}"`,
        )
        .sort();

      findings.push({
        severity: "error",
        // Filed against the alphabetically first participating domain's
        // DIRECTORY. A cycle is a property of the component, not of any one
        // file: blaming the file that happens to close it makes the finding
        // move when an unrelated import is added, and re-baselining a blocking
        // check that moves on its own is how it gets switched off. The
        // directory is stable for as long as the cycle is, and alphabetical
        // order is what keeps two runs reporting the same one.
        file: `${domainsPath}/${cycle[0]}`,
        message:
          `Circular dependency between ${cycle.length} domains: ${cycle.join(", ")}.\n` +
          `${trail.join("\n")}\n` +
          `Domains are pure business logic at the bottom of the dependency graph, so a\n` +
          `cycle means these are not independent — they are one domain pretending to be\n` +
          `${cycle.length}. Extract what they share into a separate domain they can all depend on,\n` +
          `or merge them if they are a single concern. A cycle goes load-bearing fast:\n` +
          `once feature code builds on more than one of them, breaking it means\n` +
          `restructuring all of them at once.`,
      });
    }

    return findings;
  },
};

/**
 * Every strongly connected component with more than one member — which is
 * exactly the set of domain cycles, direct and transitive alike.
 *
 * Tarjan's rather than a three-colour DFS, though a domain graph runs well under
 * 20 nodes and either would be fast enough. The reason is the reporting shape:
 * a colour walk finds a back-edge and reports THE CYCLE IT IS STANDING IN, so a
 * component holding several intertwined cycles yields one finding per run and
 * the next one only appears after the first is fixed. An SCC pass surfaces every
 * independent cycle at once, and folds the intertwined ones into a single
 * component — which is also the honest unit, since they are untangled together.
 */
function stronglyConnectedDomains(dependencies: Map<string, Set<string>>): string[][] {
  type Visit = { index: number; low: number };

  const visited = new Map<string, Visit>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const components: string[][] = [];
  let counter = 0;

  const visit = (node: string): Visit => {
    const state: Visit = { index: counter, low: counter };
    counter += 1;
    visited.set(node, state);
    stack.push(node);
    onStack.add(node);

    for (const next of dependencies.get(node) ?? []) {
      const seen = visited.get(next);
      if (seen === undefined) state.low = Math.min(state.low, visit(next).low);
      // Only a node still on the stack is an ancestor on the current path. One
      // already popped belongs to a finished component, and folding its index
      // in here merges two components that share nothing but an edge.
      else if (onStack.has(next)) state.low = Math.min(state.low, seen.index);
    }

    if (state.low === state.index) {
      // `node` is the deepest member of its own component, so everything above
      // it on the stack is the rest of that component.
      const component = stack.splice(stack.indexOf(node));
      for (const member of component) onStack.delete(member);
      components.push(component.sort());
    }

    return state;
  };

  // Sorted, so the walk order — and therefore the order findings come out in —
  // does not depend on which file the graph happened to read first.
  for (const node of [...dependencies.keys()].sort()) {
    if (!visited.has(node)) visit(node);
  }

  return components
    .filter((component) => component.length > 1)
    .sort((a, b) => (a[0] ?? "").localeCompare(b[0] ?? ""));
}
