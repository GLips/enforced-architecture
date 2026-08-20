// ─── boundary/cross-boundary-alias ────────────────────────────────────
//
// Tag:       boundary
// Mechanism: structural check (resolution across the tree)
// Blocking:  Yes
//
// Prevents:  A relative import leaving the boundary it is written in. Every
//            other boundary rule matches the ALIASED form of a path, so a
//            crossing written relatively names the same module with a string
//            none of those rules see — a working bypass for the whole
//            `boundary/` tag, and it reads as ordinary code.
//
// Relative imports INSIDE one boundary cross nothing and stay unreported. That
// exemption is the rule, not a concession: relative paths are how a module moves
// within its own boundary, and a check that reports them is one that gets
// switched off.
//
// See boundary/cross-boundary-alias.md for the negative space and the adapt
// notes, and graph/import-graph.md for how an edge gets resolved at all.
//
// ──────────────────────────────────────────────────────────────────────

import type { Finding, StructuralCheck } from "../check-substrate.ts";

export const crossBoundaryAliasCheck: StructuralCheck = {
  id: "boundary/cross-boundary-alias",

  run({ config, importGraph }) {
    const { aliasPrefix } = config.source;
    const findings: Finding[] = [];

    for (const edge of importGraph()) {
      if (!edge.relative || edge.from.boundary === edge.to.boundary) continue;

      findings.push({
        severity: "error",
        file: edge.file,
        // Undefined for a specifier the graph could not place in the text, and
        // passed through as such. A wrong line on a blocking check sends someone
        // to the wrong place, which is worse than sending them to the file.
        line: edge.line,
        message:
          `"${edge.specifier}" leaves ${edge.from.boundary} and lands in ${edge.to.boundary}.\n` +
          `Write it as "${aliasPrefix}${edge.target}" instead. The boundary rules all\n` +
          `match the aliased path, so the relative spelling of a crossing is a bypass\n` +
          `none of them see. Relative imports stay correct inside one boundary — they\n` +
          `cross nothing, and this check leaves them alone.`,
      });
    }

    return findings;
  },
};
