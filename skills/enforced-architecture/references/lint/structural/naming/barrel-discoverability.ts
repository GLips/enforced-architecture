// ─── naming/barrel-discoverability ────────────────────────────────────
//
// Makes sure: Every PUBLIC barrel lists each name it exports, with the same name
// the definition has. To learn what a module offers, you read the one barrel
// file, not the files below it. A search for a public name finds the
// definition, and a search for the definition finds the callers.
//
// Which files those are is derived from the tree's vocabulary — one barrel per
// unit of each subdivided directory — and it must not widen past them. Inside a
// module, a wildcard or an alias changes nothing that code outside the module
// can find. A check on every file then reports on correct code.
//
// A walk that matches no file is not an error, and that is this check's loudest
// blind spot: a tree whose barrels are somewhere the vocabulary does not
// describe reports clean while reading no barrel at all.
//
// `export { default as Button }` is a finding, and so is a type-only rename. Do
// not add an exception for either — a boolean that skips a branch is the branch
// deleted, one config line at a time. Do not add an exception for
// `default`. A default export has no name to search for, so the barrel holds
// the only name of that symbol. Give the definition the name.
//
// What a barrel reaches through its re-exports is api/barrel-purity's finding,
// not this one's.
// ──────────────────────────────────────────────────────────────────────

import {
  barrelModules,
  SOURCE_EXTENSION_GLOB,
  subdividedDirs,
  withoutSourceExtension,
} from "../../policy/layout.ts";
import {
  blankComments,
  collectTreeFiles,
  lineNumberAt,
  lineStartOffsets,
  readFile,
  toProjectPath,
  toSourcePath,
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
  scope: "tree",

  async run(context) {
    const { config, vocabulary } = context;
    const findings: Finding[] = [];

    // Where the barrels are is the tree's vocabulary, not this check's glob
    // list: one barrel module per subdivided unit, spelled the way this tree
    // spells barrels. A glob configured beside this rule is the same fact
    // written twice, and the copy that goes stale reports clean over the barrels
    // it no longer matches.
    const barrelGlobs = subdividedDirs(vocabulary).map((dir) => `${dir}/*/${SOURCE_EXTENSION_GLOB}`);
    const barrels = barrelModules(vocabulary);

    for (const glob of barrelGlobs) {
      // The glob carries its own path, so it is matched from the tree's source
      // root — barrels are named by where they sit. The EXTENSION is not part of
      // that name: the walk takes every source extension and the barrel name is
      // matched with the extension stripped, so an `index.mts` is the unit's
      // barrel exactly as an `index.ts` is.
      for (const absolute of collectTreeFiles(context, glob)) {
        const bare = withoutSourceExtension(toSourcePath(context, absolute));
        if (!barrels.includes(bare.slice(bare.lastIndexOf("/") + 1))) continue;

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

            const origin = module === undefined ? "" : ` from "${module}"`;
            // A type-only export is renamed at the barrel more often than a value
            // one, and the search it splits is the same search — so it reports,
            // and the note says which case this is rather than offering a way out
            // of it.
            const typeNote =
              typeOnlyList || typeOnlyMember !== undefined
                ? `\nThis one is type-only. A type is reverse-looked-up less often than a value,\n` +
                  `which is an argument for renaming the definition rather than for keeping two\n` +
                  `names nobody greps together.`
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
