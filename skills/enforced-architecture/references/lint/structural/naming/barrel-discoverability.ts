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
// A bare `export default` is the other half of that and is NOT reported: there
// is no second name to compare it against, so the rename branch has nothing to
// say about it. The symbol is nameless at the boundary all the same, and no
// check in the catalog reports that.
//
// What a barrel says is read from `module-scanning.ts`'s export record — the
// tier's one reader of an export clause — and that decides this check's blind
// spots as much as the globs do. A surface spelled `module.exports = …` has no
// export record, so it is not read here and no rule in the catalog asks whether
// it is greppable. Nothing is matched against the source text: an `export *`
// written in a comment or inside a string is not an export, and the grammar
// settles that rather than a scrubbing pass.
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
  collectTreeFiles,
  lineNumberAt,
  lineStartOffsets,
  readFile,
  toProjectPath,
  toSourcePath,
  type Finding,
  type StructuralCheck,
} from "../check-context.ts";
import { scanDeclaredExports } from "../module-scanning.ts";

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
        const source = readFile(absolute);
        const lineStarts = lineStartOffsets(source);

        // Every offer the file makes, off the parser's export record. The
        // likeliest false positive this check has is a commented-out wildcard in
        // a barrel's own header, and the grammar settles that rather than a
        // scrubbing pass. Each entry carries its own member's offset, so a list
        // running down a screen reports each name on the line it is written on.
        for (const entry of scanDeclaredExports({ path: absolute, source })) {
          const line = lineNumberAt(lineStarts, entry.offset);

          if (entry.kind === "wildcard") {
            const namespace = entry.namespace === undefined ? "" : ` as ${entry.namespace}`;
            findings.push({
              severity: "error",
              file,
              line,
              message:
                `\`export *${namespace} from "${entry.specifier}"\` hides the names this module exposes.\n` +
                `List each public symbol explicitly instead. The barrel is the map an agent\n` +
                `greps to learn what this module offers, and a wildcard leaves it blank — it\n` +
                `also lets every future export of "${entry.specifier}" join the public API with no\n` +
                `review at the boundary.`,
            });
            continue;
          }

          // A name a file both declares and offers under the same name is the
          // whole point of a barrel, so only the rename reports. `export { a as
          // a }` compares equal here and stays silent.
          if (entry.kind !== "named" || entry.localName === entry.exportedName) continue;

          const { localName, exportedName } = entry;
          const origin = entry.specifier === undefined ? "" : ` from "${entry.specifier}"`;
          // A type-only export is renamed at the barrel more often than a value
          // one, and the search it splits is the same search — so it reports,
          // and the note says which case this is rather than offering a way out
          // of it.
          const typeNote = entry.typeOnly
            ? `\nThis one is type-only. A type is reverse-looked-up less often than a value,\n` +
              `which is an argument for renaming the definition rather than for keeping two\n` +
              `names nobody greps together.`
            : "";

          findings.push({
            severity: "error",
            file,
            line,
            message:
              `\`export { ${localName} as ${exportedName} }${origin}\` renames on the way out.\n` +
              `The public name and the definition \`${localName}\` now share no text, so a reverse\n` +
              `lookup on either misses the other: grep ${exportedName} and the definition is\n` +
              `invisible, grep ${localName} and the callers are. Rename the definition to\n` +
              `${exportedName} and re-export it unaliased.${typeNote}`,
          });
        }
      }
    }

    return findings;
  },
};
