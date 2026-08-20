// ─── style/no-raw-primitives ──────────────────────────────────────────
//
// Tag:       style
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: Feature code reaching for the platform's raw building blocks
//           instead of the design system's primitives — bare `<div>` /
//           `<span>` / `<button>` on web, bare `View` / `Text` /
//           `Pressable` from `react-native` on native.
//
//           A raw element carries no token-aware defaults, so it is the
//           seam every off-system decision enters through: the moment a
//           model writes `<div>`, it must also invent the padding, the
//           color, and the type size — and it will invent them fluently
//           and slightly wrong. A primitive (`<Box>`, `<Text>` from your
//           own UI layer) accepts only token props, so the wrong value
//           does not typecheck. This is the load-bearing rule of the tag:
//           the others police escape hatches; this one closes the door
//           they leak through.
//
// Applies:  All component files EXCEPT:
//           - The primitives layer itself (it must use raw elements —
//             that is its whole job)
//           - Test files and scripts
//           - Documented render boundaries (see Adapt section 4)
//
// Error:    "Raw element — compose from the UI primitives instead
//            (Box/Stack for layout, Text for type), or use the
//            primitive's polymorphic prop when you need the semantic
//            element."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. Pick your arm. The two visitor groups cover the two platforms;
//    DELETE the constant and the handlers for the one that does not
//    apply. A react-native-web project that ships both surfaces keeps
//    both — they are independent, and a file can violate either.
//
//    - Web / DOM — `RAW_HTML_ELEMENTS`. Bans lowercase intrinsic JSX
//      tags. PascalCase component tags and member tags (`<Foo.Bar>`) are
//      never intrinsics and fall through automatically, so this set IS
//      the ban list. Most projects also want `table`, `form`, `label`,
//      `input`, `select`.
//
//    - React Native — `PLATFORM_MODULE` + `PLATFORM_RENDERING_PRIMITIVES`.
//      Bans importing core primitives from `react-native`. It keys on the
//      import, not the tag, because RN primitives are PascalCase and so
//      are your own components — `<View>` and `<Card>` are
//      indistinguishable at the tag level. The import is where they
//      separate, and it is the honest unit: a file that never imports
//      `View` cannot render one. Extend the set with anything else your
//      primitives layer wraps (`FlatList`, `SafeAreaView`, `Modal`).
//
//      Note it does NOT ban the module wholesale. Utility APIs
//      (`Platform`, `useWindowDimensions`, `StyleSheet`, `Linking`) are
//      legitimate in feature code; only the rendering primitives are the
//      design system's to own. A type-only import also passes — it
//      renders nothing.
//
// 2. `PRIMITIVES_LAYER` — wherever your `<Box>` / `<Text>` live. Default
//    is `src/shared/ui/`. This exemption is MANDATORY: without it the
//    rule forbids the primitives from being implemented at all.
//
// 3. Polymorphism, not a second ban list: do not add semantic elements
//    (`nav`, `section`, `li`) back as exemptions to keep markup
//    accessible. Give the primitive an `as` / `component` prop typed as a
//    closed union of allowed tags (`<Box as='nav'>`), so semantics stay
//    expressible without reopening an unconstrained string surface. A
//    closed union is a type-level guarantee; an exemption list is a hole
//    this rule cannot see through.
//
// 4. `RENDER_BOUNDARY` — files that legitimately emit raw elements: a
//    markdown renderer's element overrides, the root HTML document, a
//    canvas-backed widget. One path per line, each with a comment saying
//    why. Each exemption is a place drift can enter, so the reason should
//    be about the boundary, not about convenience.
//
// 5. Registration: add the rule to the project's oxlint plugin
//    (`rules: { "no-raw-primitives": noRawPrimitivesRule }`) and turn it
//    on in `.oxlintrc.json` (`"<plugin>/no-raw-primitives": "error"`).
//
// Known hole: a namespace import (`import * as RN from "react-native"`,
// then `<RN.View>`) names no specifier to check, so neither arm sees it.
// If your codebase uses that shape, ban the namespace import itself with
// a one-line rule rather than trying to thread it through here.
//
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
