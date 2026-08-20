// ─── style/vendor-component-containment ───────────────────────────────
//
// Tag:       style
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: Feature code importing a UI-library component directly when
//           the project ships its own wrapper for it.
//
//           A wrapper exists because the raw component was missing a
//           convention every use site needs — Enter-to-submit on a
//           compose box, a loading state on every button, an analytics
//           id on every link. The wrapper holds that convention in one
//           place. An import that goes around it silently reintroduces a
//           component that hand-rolls the convention, or omits it, and
//           the two versions drift apart from there. Nothing about the
//           bypassing call site looks wrong, which is why this needs a
//           rule and not a review.
//
//           This is the design-system sibling of
//           `boundary/sdk-containment`: same containment shape, applied
//           to component libraries rather than service SDKs.
//
// Applies:  All source files EXCEPT:
//           - The wrapper module itself (it must import the original)
//           - Test files and scripts
//
// Error:    "Import <Component> from the app wrapper, not the library —
//            the wrapper carries the convention every use site needs."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. `VENDOR_MODULE` — the library the wrappers wrap, matched exactly.
//    A deep path into the same library (`@mantine/core/styles.css`) is a
//    different specifier and is not checked; if the library re-exports
//    its components from subpaths too, widen this to a RegExp.
//
// 2. `WRAPPED_COMPONENTS` — the table of wrapped components. Each row
//    names the component, the wrapper module to import instead, and the
//    path of the wrapper itself, which is the ONE file allowed to import
//    the original. A newly wrapped component is a new row.
//
//    The `why` is not decoration: it is what the diagnostic says, and an
//    agent fixes what the message explains. Write the convention the
//    wrapper carries, in one sentence. When two components are wrapped
//    for genuinely different reasons, the table already keeps their
//    messages apart — that is why it is a table and not an alternation.
//
// 3. `SOURCE_ROOT` — the rule only governs application source, so
//    generated clients and config files outside `src/` are not checked.
//
// 4. Write the rule when you write the wrapper, not later: a wrapper
//    without this rule lasts about as long as the memory of the person
//    who wrote it. The bypass is invisible in review, so the rule is the
//    only thing that keeps the wrapper canonical.
//
// 5. Do not exempt "just this once". If a call site genuinely needs the
//    unwrapped component, that is usually a missing prop on the wrapper.
//    Add the prop. A second exempt path per row becomes the second
//    implementation the rule existed to prevent.
//
// 6. Registration: add the rule to the project's oxlint plugin
//    (`rules: { "vendor-component-containment": vendorComponentContainmentRule }`)
//    and turn it on in `.oxlintrc.json`
//    (`"<plugin>/vendor-component-containment": "error"`).
//
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
