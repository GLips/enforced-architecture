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
// The platform arm fences on the NAME react-native hands over, however the file
// gets at it: a named import, an alias, a namespace or default import read as
// `RN.View`, `import RN = require("react-native")`, a `require()` or
// `await import()` destructure, and a bare `(await import("react-native")).View`.
// See lib/imported-names.ts for the spellings that deliberately report nothing —
// chiefly a computed key, an interpolated specifier, and a namespace passed on
// as a value.
//
// The two RE-EXPORT spellings that hand the module on WHOLE — `export *` and
// `export { default as RN }` — report on the module rather than on a name,
// because neither names one. They are the only spellings that reach code this
// rule will never open: the importer writes `RN.View` against a local module,
// and nothing in that file names react-native. `default` needs an arm of its own
// because the specifier walk compares against the primitive NAME set and
// `default` is in no such set — the same reason
// `boundary/ambient-globals` spells it out for `export { default as proc }`.
//
// SCOPE, and it is the same for every TREE-SCOPED rule in this catalog — which
// is every rule but `testing/no-module-mocking`, whose subject is a test file and
// which is therefore enabled globally. This rule is silent outside the declared
// trees, and silent on the files `isArchitectureExemptSourcePath` names inside
// them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ──────────────────────────────────────────────────────────────────────

import { aliasSpecifierFor, sharedUiDir } from "../../policy/layout.ts";
import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { isAtProfile } from "../../policy/declared-trees.ts";
import { exportedName, visitImportedNames } from "../lib/imported-names.ts";
import { sourceOrderedReports } from "../lib/source-ordered-reports.ts";

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

export const noRawPrimitivesRule = defineTreeRule({
  meta: {
    type: "problem",
    messages: {
      rawHtmlElement:
        "Raw HTML element (highlighted) — compose from the UI primitives instead (Box/Stack/Group for layout, Text/Title for type, Button, Anchor, Image), or `<Box as='...'>` with the tag name when you need the semantic element. A raw element has no token-aware defaults, so every value on it has to be invented. See docs/architecture/design-system.md.",
      platformPrimitive:
        "Core react-native rendering primitive (highlighted) — import the app equivalent from {{sharedUi}} instead (Box/Stack for View, Text for Text, a Button/Pressable wrapper for touchables). Those take token props, so an off-system value cannot be passed. Utility APIs from react-native (Platform, StyleSheet, useWindowDimensions) are fine in feature code; only the rendering primitives are the design system's to own. See docs/architecture/design-system.md.",
      platformModuleReExport:
        "This republishes the whole react-native module under this module's name, so any importer gets View/Text/Pressable without ever naming react-native. Re-export the named utility APIs you actually need instead. See docs/architecture/design-system.md.",
    },
  },
  create(context, role) {
    // Both exemptions as PROFILES, which is one owner for "where am I" rather
    // than two spellings of it. A feature's own `shared/ui/` folder, or a
    // `shared/ui-legacy/`, does not inherit the primitives-layer exemption; and
    // the render boundary is `root-route`, which `classifySourcePath` already
    // resolves by exact path, so a nested `_layout.tsx` cannot collect it.
    //
    // Asking by profile rather than by module name is also what keeps this arm
    // silent in a tree that declares it has no root route: there is no such
    // position there, so nothing matches. A module comparison would need its own
    // opinion about what an absent name compares equal to.
    if (isAtProfile(role, "shared-ui", "root-route")) return {};

    // Both arms report, and the React Native one only finds its names once the whole file is
    // walked — so without a single ordering owner a file's diagnostics come out with every
    // imported name after every raw element, whatever their line numbers.
    const ordered = sourceOrderedReports(context);
    const sharedUi = { sharedUi: aliasSpecifierFor(role.tree.vocabulary, sharedUiDir(role.tree.vocabulary)) };

    return {
      // --- React Native arm ---
      // Every name the file takes from the platform module, under react-native's own spelling —
      // so `View as Screen` and `RN.View` are the same finding as `View`.
      ...visitImportedNames(context.sourceCode, [PLATFORM_MODULE], (name, node) => {
        if (PLATFORM_RENDERING_PRIMITIVES.has(name)) {
          ordered.report({ node, messageId: "platformPrimitive", data: sharedUi });
        }
      }),

      // --- Web / DOM arm ---
      // One handler covers self-closing and has-children, with attributes or without: every
      // element has exactly one opening tag, whatever it wraps.
      JSXOpeningElement(node) {
        // A member or namespaced name (`<Foo.Bar>`, `<svg:rect>`) is never an intrinsic.
        if (node.name.type !== "JSXIdentifier") return;
        if (RAW_HTML_ELEMENTS.has(node.name.name)) {
          ordered.report({ node: node.name, messageId: "rawHtmlElement" });
        }
      },

      // `export { View } from "react-native"` hands the primitive to every importer of this
      // module without the word `import` appearing anywhere — the same leak, one keyword over.
      ExportNamedDeclaration(node) {
        if (node.source === null || node.source.value !== PLATFORM_MODULE) return;
        if (node.exportKind === "type") return;

        for (const specifier of node.specifiers) {
          if (specifier.exportKind === "type") continue;
          const source = exportedName(specifier.local);
          // `export { default as RN }` republishes the module OBJECT, which is the segment above
          // every primitive — `RN.View` on the importer's side, and this rule never reads that
          // file's react-native imports because it has none. The same laundering as `export *`,
          // and the name table cannot see it: `default` is in no primitive set.
          if (source === "default") {
            ordered.report({ node: specifier, messageId: "platformModuleReExport" });
            continue;
          }
          if (PLATFORM_RENDERING_PRIMITIVES.has(source)) {
            ordered.report({ node: specifier, messageId: "platformPrimitive", data: sharedUi });
          }
        }
      },

      ExportAllDeclaration(node) {
        if (node.source.value !== PLATFORM_MODULE) return;
        if (node.exportKind === "type") return;
        ordered.report({ node: node.source, messageId: "platformModuleReExport" });
      },

      // This rule owns `Program:exit` outright — see lib/source-ordered-reports.ts for why a
      // spread one cannot be allowed to share the key.
      "Program:exit"() {
        ordered.flushInSourceOrder();
      },
    };
  },
});
