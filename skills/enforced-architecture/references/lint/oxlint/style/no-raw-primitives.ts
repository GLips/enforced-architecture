// ─── style/no-raw-primitives ──────────────────────────────────────────
//
// Makes sure: Feature code renders through the design system's primitives, not
// the platform's raw elements. No file writes a bare `<div>`, and none takes
// `View` or `Text` from `react-native` by import, named re-export, or star
// re-export. A primitive takes token props only, so a call site names a token,
// never a px number or a hex.
//
// The primitives-layer exemption is mandatory: those files must use raw
// elements, so without it the rule forbids its own fix. Each RENDER_BOUNDARY
// path is one more file the rule does not read; give a reason about the
// boundary rather than about convenience.
//
// Do not add semantic elements (`nav`, `section`, `li`) back as exemptions for
// accessible markup. Give the primitive an `as` prop typed as a closed union
// (`<Box as='nav'>`). The compiler enforces a closed union; an exemption is
// a file this rule does not read.
//
// Do not ban `react-native` whole. `Platform`, `StyleSheet` and
// `useWindowDimensions` are correct in feature code, and a rule that fails a
// commit on correct code is one people disable.
//
// A namespace import (`import * as RN from "react-native"`, then `<RN.View>`)
// names no specifier, and neither arm reports it. Ban that import shape on its
// own if the codebase writes it.
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

const RAW_HTML_ELEMENTS = new Set([
  "div", "span", "p", "main", "section", "header", "footer", "nav", "aside", "article",
  "ul", "ol", "li", "button", "a", "h1", "h2", "h3", "h4", "h5", "h6", "img",
]);

const PLATFORM_MODULE = "react-native";

// The rendering primitives the design system owns. Utility APIs from the platform module
// (Platform, StyleSheet, useWindowDimensions) are deliberately absent — those are legitimate in
// feature code.
const PLATFORM_RENDERING_PRIMITIVES = new Set([
  "View", "Text", "Pressable", "TouchableOpacity", "ScrollView", "TextInput", "Image",
]);

// Anchored on `/src/` so a feature's own `shared/ui/` folder, or a `src/shared/ui-legacy/`, does
// not inherit the primitives layer's exemption.
const PRIMITIVES_LAYER = /\/src\/shared\/ui\//;
const RENDER_BOUNDARY = /\/src\/routes\/__root\.tsx$/;

/** The exporting module's name for a specifier, which is the one a local alias cannot change. */
function exportedName(name: ESTree.ModuleExportName): string {
  return name.type === "Literal" ? name.value : name.name;
}

export const noRawPrimitivesRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      rawHtmlElement:
        "Raw HTML element (highlighted) — compose from the UI primitives instead (Box/Stack/Group for layout, Text/Title for type, Button, Anchor, Image), or `<Box as='...'>` with the tag name when you need the semantic element. A raw element has no token-aware defaults, so every value on it has to be invented. See docs/architecture/design-system.md.",
      platformPrimitive:
        "Core react-native rendering primitive (highlighted) — import the app equivalent from @/shared/ui instead (Box/Stack for View, Text for Text, a Button/Pressable wrapper for touchables). Those take token props, so an off-system value cannot be passed. Utility APIs from react-native (Platform, StyleSheet, useWindowDimensions) are fine in feature code; only the rendering primitives are the design system's to own. See docs/architecture/design-system.md.",
      platformStarReExport:
        "A star re-export of react-native republishes every rendering primitive under this module's name, so any importer gets View/Text/Pressable without ever naming react-native. Re-export the named utility APIs you actually need instead. See docs/architecture/design-system.md.",
    },
  },
  create(context) {
    const { filename } = context;
    if (isArchitectureExemptPath(filename)) return {};
    if (PRIMITIVES_LAYER.test(filename) || RENDER_BOUNDARY.test(filename)) return {};

    return {
      // --- Web / DOM arm ---
      // One handler covers self-closing and has-children, with attributes or without: every
      // element has exactly one opening tag, whatever it wraps.
      JSXOpeningElement(node) {
        // A member or namespaced name (`<Foo.Bar>`, `<svg:rect>`) is never an intrinsic.
        if (node.name.type !== "JSXIdentifier") return;
        if (RAW_HTML_ELEMENTS.has(node.name.name)) {
          context.report({ node: node.name, messageId: "rawHtmlElement" });
        }
      },

      // --- React Native arm ---
      ImportDeclaration(node) {
        if (node.source.value !== PLATFORM_MODULE) return;
        // A type-only import renders nothing.
        if (node.importKind === "type") return;

        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier" || specifier.importKind === "type") continue;
          // The imported name, not the local one, so `View as Screen` cannot dodge the check.
          if (PLATFORM_RENDERING_PRIMITIVES.has(exportedName(specifier.imported))) {
            context.report({ node: specifier, messageId: "platformPrimitive" });
          }
        }
      },

      // `export { View } from "react-native"` hands the primitive to every importer of this
      // module without the word `import` appearing anywhere — the same leak, one keyword over.
      ExportNamedDeclaration(node) {
        if (node.source === null || node.source.value !== PLATFORM_MODULE) return;
        if (node.exportKind === "type") return;

        for (const specifier of node.specifiers) {
          if (specifier.exportKind === "type") continue;
          if (PLATFORM_RENDERING_PRIMITIVES.has(exportedName(specifier.local))) {
            context.report({ node: specifier, messageId: "platformPrimitive" });
          }
        }
      },

      ExportAllDeclaration(node) {
        if (node.source.value !== PLATFORM_MODULE) return;
        if (node.exportKind === "type") return;
        context.report({ node: node.source, messageId: "platformStarReExport" });
      },
    };
  },
});
