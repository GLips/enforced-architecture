import type { CheckFixtures } from "../../expectations.ts";

export const importPolicyFixtures: CheckFixtures = {
  check: "boundary/import-policy",

  obvious: [
    // The sibling feature, reached as `../../beta/…`. The specifier holds no
    // `features/` segment at all, so it is the crossing a spelling matcher
    // cannot see — and the shortest, most innocuous one to write. It is also a
    // DEEP import into that feature, so the finding is the semantic denial and
    // not merely the spelling.
    "FAIL src/features/alpha/ui/sibling-crossing.ts",
    // The long climb out to another top-level boundary, which a spelling matcher
    // DOES catch. Here as the regression guard: resolving properly had to keep
    // what a pattern already got right. The edge is PERMITTED — a feature may
    // use a shared helper — so this is the alias-spelling half of the check.
    "FAIL src/features/alpha/ui/long-climb-crossing.ts",
    // A direction denial reached through a relative specifier. src/shared may
    // import nothing back, and the check this replaces could only ever say "you
    // spelled it relatively" — which invited the fix of writing the alias, the
    // same violation with a longer name.
    "FAIL src/shared/lib/adapter-crossing.ts",
  ],

  // Every one of these is the same crossing written the way an extractor loses
  // it. Each carries a REAL violation inside the affected span — written with a
  // legal import instead, the edge is lost just the same and this stays green.
  adversarial: [
    // Listed twice because it fires twice: a wrapped static `from` and a wrapped
    // re-export `from`. The multiset count is the assertion — a check that found
    // one of the two spellings passes a set comparison.
    "FAIL src/features/alpha/ui/wrapped-static-crossing.ts",
    "FAIL src/features/alpha/ui/wrapped-static-crossing.ts",
    "FAIL src/features/alpha/ui/wrapped-dynamic-crossing.ts",
    "FAIL src/features/alpha/ui/wrapped-require-crossing.ts",
    // Three syntax classes that defeat delimiter pairing rather than line
    // splitting: a backtick inside a quoted string, a backtick inside a regex
    // literal, and an import inside a `${…}` interpolation — where blanking
    // template text wholesale deletes a real edge.
    "FAIL src/features/alpha/ui/quoted-backtick-crossing.ts",
    "FAIL src/features/alpha/ui/regex-tick-crossing.ts",
    "FAIL src/features/alpha/ui/interpolated-crossing.ts",
    // A generic arrow in a plain `.ts` file. Under the `tsx` loader it reads as
    // unclosed JSX and the reader throws, taking the whole graph with it — so
    // this one is caught by the crash guard rather than by a missing finding.
    "FAIL src/features/alpha/ui/generic-arrow-crossing.ts",
    // The lineless path: a unicode-escaped specifier comes back from the reader
    // cooked and matches no literal in the text. Reported against the file with
    // no line, which is why this check must tolerate `line === undefined`.
    "FAIL src/features/alpha/ui/escaped-specifier-crossing.ts",
    // A shebang, which is valid at the top of an executable source file and
    // which the reader rejects outright. Same whole-graph abort as the generic
    // arrow above, different cause: every graph-reading check goes silent at
    // once, so this is caught by the crash guard rather than by a missing
    // finding. The blanking pass in `lint/structural/import-graph.ts` is what it
    // holds in place.
    "FAIL src/features/alpha/ui/shebang-crossing.ts",
    // THE hole this check was rebuilt around. `shared/ui/**` and `shared/**` are
    // one boundary, so the boundary comparison this replaces stayed quiet, and
    // the aliased shared-ui rule matched no relative specifier — the edge was
    // governed by nothing, in the layout the catalog itself recommends.
    "FAIL src/shared/ui/shared-crossing.ts",
    // Listed ONCE against a file with TWO relative imports. Being in no area is
    // a fact about the file, not about each of its imports, so the count is the
    // assertion: a check that reports per edge floods a single mistake.
    "FAIL src/lib/format-date.ts",
  ],

  legal: [
    // Two files directly in the source root importing each other. They have no
    // directory component, so taking "the first path segment" as the unit reads
    // them as two units and invents a crossing.
    "src/entry-neighbour.ts",
    "src/root-neighbour.ts",
    // Relative imports landing inside features/alpha, in both the plain and the
    // wrapped spelling. The climb is the same shape as the fires-cases; only
    // where it lands differs, so a check keying on `../` counts reports these.
    "src/features/alpha/ui/within-feature-neighbour.ts",
    "src/features/alpha/ui/wrapped-within-feature-neighbour.ts",
    // A primitive importing a sibling primitive. The flip side of
    // shared-crossing.ts: both climb out of `shared/ui/` in the specifier and
    // only one of them leaves the unit.
    "src/shared/ui/primitive-neighbour.ts",
    // A crossing written inside a template literal. This check blocks, so
    // matching import statements as text fails the commit on documentation.
    "src/features/alpha/ui/prose-neighbour.ts",
    // `../styles.css?url` resolves inside the source tree and into another
    // boundary. A stylesheet is not a module edge, and this is what routes/
    // imports today — so without the asset exclusion the check's first run is a
    // false positive against real code.
    "src/routes/asset-neighbour.ts",
  ],
};
