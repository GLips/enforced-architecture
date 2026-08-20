// ─── naming/barrel-discoverability ────────────────────────────────────
//
// Tag:       naming
// Mechanism: structural check (a declared set of files, not a handed one)
// Blocking:  Yes
//
// Prevents:  A public barrel hiding or renaming what it exposes. A wildcard
//            advertises no names at all, so grepping the barrel for a module's
//            surface finds nothing and every new export leaks through the
//            public API unreviewed. A rename leaves the public name and the
//            definition sharing no text, so a reverse lookup on either one
//            finds half the story.
//
// Nothing here is structural: every question this asks is decidable from the
// one file in hand. It is a script because barrels are few and short, so the
// glob costs nothing and it rides along with naming/test-file-mirror, which
// does need the filesystem. See naming/barrel-discoverability.md for what
// porting it to the lint tier would take.
//
// ──────────────────────────────────────────────────────────────────────

import {
  blankComments,
  collectFiles,
  lineNumberAt,
  lineStartOffsets,
  readFile,
  toProjectPath,
  type Finding,
  type StructuralCheck,
} from "../check-substrate.ts";

/**
 * `export * from "…"` and `export * as ns from "…"`, plus the type-only
 * spellings of both.
 *
 * The namespace clause is optional rather than a second pattern, because the
 * two hide exactly the same thing: a matcher anchored on `* from` walks past
 * `export * as ns from` while reporting the barrel next to it, which reads as a
 * clean file rather than a blind spot.
 */
const WILDCARD_REEXPORT =
  /\bexport\s+(?:type\s+)?\*(\s+as\s+[A-Za-z_$][\w$]*)?\s+from\s*["']([^"']+)["']/g;

/**
 * An export list, with or without a `from` clause. Both are in scope: a barrel
 * that imports a name and re-exports it aliased in a second statement splits a
 * reverse lookup exactly as much as the one-line form.
 */
const EXPORT_LIST = /\bexport\s+(type\s+)?\{([^}]*)\}(?:\s*from\s*["']([^"']+)["'])?/g;

/** One member of an export list, carrying its own optional `type` modifier. */
const LIST_MEMBER = /^(type\s+)?([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/;

export const barrelDiscoverabilityCheck: StructuralCheck = {
  id: "naming/barrel-discoverability",

  run({ config }) {
    const { barrelGlobs, flagTypeAliases } = config.checks["naming/barrel-discoverability"];
    const findings: Finding[] = [];

    for (const glob of barrelGlobs) {
      // The glob carries its own path, so the root is empty and the whole
      // pattern is source-root-relative — barrels are named by where they sit.
      for (const absolute of collectFiles(config, "", glob, { fromSourceRoot: true })) {
        const file = toProjectPath(config, absolute);
        // Blanked, never stripped: the reported line is the only thing that
        // sends a reader to the statement, and a commented-out `export *` in a
        // barrel's own header is the likeliest false positive this check has.
        const source = blankComments(readFile(absolute));
        const lineStarts = lineStartOffsets(source);

        for (const match of source.matchAll(WILDCARD_REEXPORT)) {
          const namespace = match[1]?.trim() ?? "";
          findings.push({
            severity: "error",
            file,
            line: lineNumberAt(lineStarts, match.index),
            message:
              `\`export *${namespace ? ` ${namespace}` : ""} from "${match[2]}"\` hides the names this module exposes.\n` +
              `List each public symbol explicitly instead. The barrel is the map an agent\n` +
              `greps to learn what this module offers, and a wildcard leaves it blank — it\n` +
              `also lets every future export of "${match[2]}" join the public API with no\n` +
              `review at the boundary.`,
          });
        }

        for (const match of source.matchAll(EXPORT_LIST)) {
          const typeOnlyList = match[1] !== undefined;
          const list = match[2] ?? "";
          const module = match[3];
          // Offsets are tracked through the split so each member is reported on
          // its OWN line: a barrel's export list routinely spans a screen, and
          // the statement's first line is not where the alias is.
          let cursor = match.index + match[0].indexOf("{") + 1;

          for (const raw of list.split(",")) {
            const memberStart = cursor + (raw.length - raw.trimStart().length);
            cursor += raw.length + 1;

            const member = LIST_MEMBER.exec(raw.trim());
            if (member === null) continue;

            const [, typeOnlyMember, local, exported] = member;
            if (exported === undefined || local === exported) continue;
            if (!flagTypeAliases && (typeOnlyList || typeOnlyMember !== undefined)) continue;

            const origin = module === undefined ? "" : ` from "${module}"`;
            const typeNote =
              typeOnlyList || typeOnlyMember !== undefined
                ? `\nThis one is type-only. If the project genuinely relies on aliasing types at\n` +
                  `the barrel, turn off \`flagTypeAliases\` — but the split search is the same.`
                : "";

            findings.push({
              severity: "error",
              file,
              line: lineNumberAt(lineStarts, memberStart),
              message:
                `\`export { ${local} as ${exported} }${origin}\` renames on the way out.\n` +
                `The public name and the definition \`${local}\` now share no text, so a reverse\n` +
                `lookup on either misses the other: grep ${exported} and the definition is\n` +
                `invisible, grep ${local} and the callers are. Rename the definition to\n` +
                `${exported} and re-export it unaliased.${typeNote}`,
            });
          }
        }
      }
    }

    return findings;
  },
};
