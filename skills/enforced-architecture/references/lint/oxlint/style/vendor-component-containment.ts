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
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

const VENDOR_MODULE = "@mantine/core";

const WRAPPED_COMPONENTS: Record<string, { wrapper: string; why: string; wrapperPath: RegExp }> = {
  Textarea: {
    wrapper: "@/shared/ui/textarea",
    why: "The app wrapper carries the convention every compose box shares (Enter submits, Shift+Enter inserts a newline, via onEnter); importing the library component directly reintroduces a field that hand-rolls or omits it.",
    wrapperPath: /\/src\/shared\/ui\/textarea\.tsx$/,
  },
};

const SOURCE_ROOT = /\/src\//;

/** The exporting module's name for a specifier, which is the one a local alias cannot change. */
function exportedName(name: ESTree.ModuleExportName): string {
  return name.type === "Literal" ? name.value : name.name;
}

export const vendorComponentContainmentRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      unwrappedVendorComponent:
        "Import {{component}} from {{wrapper}}, not {{vendor}}. {{why}} Only the wrapper itself may import the original. See docs/architecture/design-system.md.",
      vendorStarReExport:
        "A star re-export of {{vendor}} republishes every wrapped component under this module's name, so an importer reaches the unwrapped original without ever naming the library. Re-export the specific components you mean instead. See docs/architecture/design-system.md.",
    },
  },
  create(context) {
    const { filename } = context;
    if (!SOURCE_ROOT.test(filename) || isArchitectureExemptPath(filename)) return {};

    const reportIfWrapped = (node: ESTree.Node, component: string) => {
      const wrapped = WRAPPED_COMPONENTS[component];
      // The wrapper module MUST import the original — it is the one file that may.
      if (wrapped === undefined || wrapped.wrapperPath.test(filename)) return;
      context.report({
        node,
        messageId: "unwrappedVendorComponent",
        data: { component, wrapper: wrapped.wrapper, why: wrapped.why, vendor: VENDOR_MODULE },
      });
    };

    return {
      ImportDeclaration(node) {
        if (node.source.value !== VENDOR_MODULE) return;
        // A type-only import pulls in no runtime component, so it cannot bypass a wrapper.
        if (node.importKind === "type") return;

        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") continue;
          // The imported name, not the local one, so `Textarea as MantineTextarea` cannot dodge
          // the check. The table is keyed on exact names, so `TextareaProps` and
          // `TextareaAutosize` are different components rather than prefix matches.
          reportIfWrapped(specifier, exportedName(specifier.imported));
        }
      },

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
        context.report({
          node: node.source,
          messageId: "vendorStarReExport",
          data: { vendor: VENDOR_MODULE },
        });
      },
    };
  },
});
