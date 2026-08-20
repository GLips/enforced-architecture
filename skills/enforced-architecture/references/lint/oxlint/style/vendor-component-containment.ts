// ─── style/vendor-component-containment ───────────────────────────────
//
// Makes sure: Every use of a wrapped vendor component goes through the app
// wrapper. No file imports the original from the library, and no module
// re-exports it — by name or by star — under its own name. To swap the library,
// or to add a convention every use site needs, you edit the wrapper alone.
//
// A wrapper with no row in WRAPPED_COMPONENTS is not enforced at all. Write the
// row when you write the wrapper: nothing about a call site that bypasses it
// looks wrong in review, so this table is what keeps the wrapper canonical.
//
// VENDOR_MODULE matches one exact specifier. A library that also serves its
// components from subpaths (`@mantine/core/Textarea`) keeps this rule green
// while the call site holds the unwrapped original. Widen it to a RegExp there.
//
// The `why` field is the text of the diagnostic. An agent fixes what the
// message explains, so write the convention the wrapper carries in one
// sentence.
//
// Do not add a second exempt path to a row. A call site that needs the
// unwrapped component names a missing prop on the wrapper. Add the prop; a
// second exempt file is the second implementation this rule exists to stop.
//
// The import arm fences on the NAME the library hands over, however the file
// gets at it: a named import, an alias, a namespace or default import read as
// `Mantine.Textarea`, `import M = require("@mantine/core")`, a `require()` or
// `await import()` destructure, and a bare
// `(await import("@mantine/core")).Textarea`. See lib/imported-names.ts for the
// spellings that deliberately report nothing — chiefly a computed key, an
// interpolated specifier, and a namespace passed on as a value.
//
// SCOPE, and it is the same for every rule in this catalog: this rule is silent
// outside the declared trees, and silent on the files `isArchitectureExemptPath`
// names inside them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { type ESTree } from "@oxlint/plugins";
import { isModule } from "../../policy/declared-trees.ts";
import {
  aliasSpecifierFor,
  sharedUiDir,
} from "../../policy/layout.ts";
import { exportedName, visitImportedNames } from "../lib/imported-names.ts";
import { sourceOrderedReports } from "../lib/source-ordered-reports.ts";

const VENDOR_MODULE = "@mantine/core";

/**
 * The wrapper module for each contained component, named RELATIVE to the tree's
 * primitives directory. Relative because that directory is vocabulary: a project
 * that calls it `design-system/` renames it once and every row here follows,
 * where a hard-coded `@/shared/ui/textarea` would leave the wrapper importing the
 * original and reporting itself.
 */
const WRAPPED_COMPONENTS: Record<string, { wrapperModule: string; why: string }> = {
  Textarea: {
    wrapperModule: "textarea",
    why: "The app wrapper carries the convention every compose box shares (Enter submits, Shift+Enter inserts a newline, via onEnter); importing the library component directly reintroduces a field that hand-rolls or omits it.",
  },
};

export const vendorComponentContainmentRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      unwrappedVendorComponent:
        "Import {{component}} from {{wrapper}}, not {{vendor}}. {{why}} Only the wrapper itself may import the original. See docs/architecture/design-system.md.",
      vendorStarReExport:
        "A star re-export of {{vendor}} republishes every wrapped component under this module's name, so an importer reaches the unwrapped original without ever naming the library. Re-export the specific components you mean instead. See docs/architecture/design-system.md.",
    },
  },
  create(context, role) {
    const { vocabulary } = role.tree;
    const wrapperPathOf = (wrapperModule: string) =>
      `${sharedUiDir(vocabulary)}/${wrapperModule}`;

    // The import arm only finds its names once the whole file is walked, so without a single
    // ordering owner every one of them lands after every re-export diagnostic, whatever the lines.
    const ordered = sourceOrderedReports(context);

    const reportIfWrapped = (node: ESTree.Node, component: string) => {
      const wrapped = WRAPPED_COMPONENTS[component];
      if (wrapped === undefined) return;
      const wrapperPath = wrapperPathOf(wrapped.wrapperModule);
      // The wrapper module MUST import the original — it is the one file that may.
      if (isModule(role, wrapperPath)) return;
      ordered.report({
        node,
        messageId: "unwrappedVendorComponent",
        data: {
          component,
          wrapper: aliasSpecifierFor(vocabulary, wrapperPath),
          why: wrapped.why,
          vendor: VENDOR_MODULE,
        },
      });
    };

    return {
      // The library's name for the component, not the local one, so `Textarea as MantineTextarea`
      // cannot dodge the check. The table is keyed on exact names, so `TextareaProps` and
      // `TextareaAutosize` are different components rather than prefix matches.
      ...visitImportedNames(context.sourceCode, [VENDOR_MODULE], (component, node) => {
        reportIfWrapped(node, component);
      }),

      // `export { Textarea } from "@mantine/core"` hands the unwrapped component to every importer
      // of this module without the word `import` appearing anywhere — the same bypass, one
      // keyword over.
      ExportNamedDeclaration(node) {
        if (node.source === null || node.source.value !== VENDOR_MODULE) return;
        if (node.exportKind === "type") return;

        for (const specifier of node.specifiers) {
          if (specifier.exportKind === "type") continue;
          reportIfWrapped(specifier, exportedName(specifier.local));
        }
      },

      ExportAllDeclaration(node) {
        if (node.source.value !== VENDOR_MODULE) return;
        if (node.exportKind === "type") return;
        // A star re-export names no specifier to blame, and republishes every wrapped component
        // at once — including ones added to the table later.
        ordered.report({
          node: node.source,
          messageId: "vendorStarReExport",
          data: { vendor: VENDOR_MODULE },
        });
      },

      // This rule owns `Program:exit` outright — see lib/source-ordered-reports.ts for why a
      // spread one cannot be allowed to share the key.
      "Program:exit"() {
        ordered.flushInSourceOrder();
      },
    };
  },
});
