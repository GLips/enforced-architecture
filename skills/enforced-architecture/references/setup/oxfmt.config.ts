// Copy to the repo root as `oxfmt.config.ts`. The pre-commit hook's one WRITER
// (`setup/lefthook.yml`), and the only tool in this stack that rewrites source.
//
// Formatting is taste and this file mostly declines to have any — the width and
// the quotes below are defaults restated so a project can find them. ONE block
// here is architecture rather than taste, and it is the reason this file is
// shipped at all: `sortImports`, and specifically where stylesheets land.

import { defineConfig } from "oxfmt";

export default defineConfig({
  printWidth: 100,
  singleQuote: false,
  trailingComma: "all",

  // ── stylesheet order is CASCADE order ───────────────────────────────────
  //
  // For unlayered CSS the last stylesheet in wins the tie, so the order of
  // side-effect imports decides which rule paints the pixel. A vendor stylesheet
  // that lands after the project's own silently reverts every override in it,
  // and nothing reports: the class is applied, the property is set, and the
  // value is the vendor's. That is a styling decision made by import order,
  // which is exactly the kind of thing this catalog refuses to leave to
  // convention.
  //
  // `sortSideEffects` is the load-bearing flag and it is OFF by default. Without
  // it oxfmt leaves `import "./styles.css"` exactly where it sits — the correct
  // default in general, because a side-effect import's position can carry
  // meaning (a polyfill before its consumer), and the wrong one here, because
  // for stylesheets the position IS the meaning and leaving it unmanaged is what
  // produces the bug above.
  //
  // PREFER CSS LAYERS WHERE THE VENDOR SHIPS THEM. Mantine publishes
  // `@mantine/core/styles.layer.css`, wrapping its rules in `@layer mantine`;
  // any unlayered rule beats any layered one regardless of order, so the whole
  // question disappears. Where a layered build exists this block is a second
  // belt — keep it, since a project's own stylesheets are usually unlayered
  // among themselves. Where one does not, it is the only fence there is.
  //
  // NEGATIVE SPACE: a project whose styles are all in TypeScript — React Native,
  // StyleX, vanilla-extract — has no subject here, and these groups match
  // nothing. That is the same conditional `structural/style/css-tokens` carries,
  // and it is the rule standing ready rather than a reason to delete it.
  sortImports: {
    sortSideEffects: true,
    newlinesBetween: false,
    customGroups: [
      // Matched BEFORE `package_styles` on purpose: a local `./styles.css` is
      // not a package stylesheet, and the package pattern below would claim it.
      { groupName: "css_modules", elementNamePattern: ["**/*.module.css"] },
      { groupName: "local_css", elementNamePattern: ["./**/*.css", "../**/*.css"] },
      {
        groupName: "package_styles",
        elementNamePattern: ["**/styles.css", "**/styles.layer.css"],
      },
    ],
    // Vendor stylesheets first, the project's own last. Everything between is
    // ordinary module ordering and carries no cascade meaning.
    groups: [
      "package_styles",
      { newlinesBetween: true },
      "builtin",
      "external",
      "internal",
      "parent",
      "sibling",
      "index",
      "css_modules",
      "local_css",
      "unknown",
    ],
  },

  // The formatter must not reorder `package.json`. Its key order is read by
  // humans and by nothing else, and a reorder at commit time turns every
  // dependency change into a whole-file diff.
  sortPackageJson: false,

  // Generated and vendored trees. `lint/policy/declared-trees.ts` owns the
  // authoritative list for the LINTER via each tree's `generatedDir`; this is
  // the formatter's own copy, and the two are allowed to differ — a generated
  // file that is never linted may still want formatting.
  // `.claude/` is installed skills and agents, vendored like node_modules.
  ignorePatterns: ["*.d.ts", "*.md", "*.mdx", ".claude/**"],
});
