// ─── boundary/ambient-globals ────────────────────────────────────────
//
// Tag:       boundary
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking:  Yes
//
// Prevents: Any module but the one designated to own it reading a
//           runtime capability that arrives as an ambient global —
//           `process.env`, `fetch`, `localStorage`, `location`,
//           `crypto`, `navigator`. Every other rule in this tag matches
//           an import specifier. A global is never imported, so an
//           import rule cannot see one: this is the rule that fences a
//           capability nothing in the module graph mentions.
//
//           The reasoning is `sdk-containment`'s, one level down. A
//           capability with configuration attached — a base URL, a key
//           namespace, a serialization format, a platform that throws —
//           wants ONE door, so the guards and the encoding are decided
//           once instead of at each call site.
//
//           Overlaps `react/no-direct-fetch` deliberately, and they are
//           not interchangeable. That rule is a component-level smell
//           for a project with no typed client — it bans `fetch` in
//           `.tsx` and leaves every `.ts` file alone. This rule's
//           `fetch` entry is the repo-wide version for a project that
//           HAS a client module to point at. Adopt one. Adopting both
//           means every component violation draws two diagnostics
//           saying different things.
//
// Applies:  All src/** files EXCEPT each global's own owning module and
//           tests/scripts.
//
// Error:    "Only @/env reads `process.env`. <why> Import it from there
//            instead of reading the global here."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. `RESTRICTED_AMBIENT_GLOBALS` — the entire policy. The rule takes no
//    stance on any particular global; a global absent from this list is
//    unrestricted, and the shipped entries are the catalog's standard
//    layout, not a claim about yours. Each entry takes one of three
//    stances:
//
//    - CONTAIN (`allowedIn: [ONE_MODULE]`) — the stance most entries
//      want. The capability is legitimate and needs exactly one door:
//      `fetch` behind the API client so auth headers, timeouts and
//      error decoding are decided once; `localStorage` behind a storage
//      wrapper so key names and serialization are, and so the SSR and
//      private-mode cases where the API throws are handled in the one
//      place that can.
//    - BAN (`allowedIn: []`) — no module owns it, so the diagnostic
//      points at nothing and says so. For a capability the project has
//      decided against outright: `document.cookie` under a cookie
//      library, `alert`, `localStorage` in a codebase that must run
//      server-side.
//    - LEAVE UNLISTED — the default for everything else. A list that
//      grows past the capabilities with a real owner teaches people the
//      rule is arbitrary, which is what gets it switched off.
//
// 2. `globalPath` — how a path is spelled. Write it HOST-FREE, as the
//    shortest read: `localStorage`, not `window.localStorage`. The rule
//    strips `window` / `globalThis` / `self` / `global` before matching,
//    so one entry covers every host spelling plus the computed forms.
//    A dotted path (`process.env`) matches that prefix and everything
//    under it; `process.version` is a different read and is not matched.
//
// 3. `alsoImportedFrom` — for a capability that is ALSO a module export,
//    where a module spelling would otherwise walk around every
//    global-shaped check above. `process.env` is the one in the
//    defaults, and it arrives five ways with the word `process` never
//    appearing as a global: a named import, a namespace import, a
//    default import (including `{ default as proc }`), a `require`, and
//    a re-export. The last is the one worth understanding — `export
//    { env } from "node:process"` hands the capability to every
//    downstream importer while the file doing it never reads anything,
//    so it is the one spelling that defeats a per-file rule everywhere
//    except here.
//
// 4. `owner` and `why` land in the diagnostic. `why` is what makes the
//    rule teachable: the reader needs the reason the capability has one
//    door, not a restatement that it does.
//
// 5. Scope is `/src/`, so build-time config (vite.config.ts,
//    next.config.js) is unaffected. Deliberate, and inherited from the
//    rule this one absorbed: what the BUILD reads is a different
//    question from what a RUNNING app believes, and conflating them
//    forces an exemption that then gets reused for runtime code.
//
// 6. What this rule deliberately does NOT catch, so a reader does not
//    mistake silence for absence:
//    - A local binding that shadows the name. `const fetch = mine;
//      fetch()` is not the ambient global and is left alone — the rule
//      resolves references rather than matching names, which is also
//      what keeps `client.fetch()` and `{ fetch: 1 }` out.
//    - One hop through a local alias of the global OBJECT:
//      `const g = globalThis; g.localStorage`. The direct destructure
//      (`const { localStorage } = window`) IS caught; a rebound host is
//      not, and nothing per-file can follow it in general.
//    - A computed key that is not a string literal:
//      ``globalThis[`local${"Storage"}`]``. Unfenceable, same as a
//      templated import specifier.
//    - A namespace, default or `require` binding for a BARE global
//      path. Those bind the path's FIRST segment, and a bare global has
//      no segment above it to rebind, so `import * as u from "undici"`
//      is left alone while `import { fetch } from "undici"` and
//      `const { fetch } = require("undici")` are both matched.
//    - Type-only imports and re-exports. `import type { env } from
//      "node:process"` is erased and reads nothing.
//
// 7. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "ambient-globals": ambientGlobalsRule }`) and turn it on
//    in `.oxlintrc.json` (`"<plugin>/ambient-globals": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import {
  defineRule,
  type ESTree,
  type Reference,
  type SourceCode,
} from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

type AmbientGlobalPolicy = {
  /** The read as it is spelled in source, host-free: `fetch`, `process.env`. */
  globalPath: string;
  /** Files permitted to touch it. An EMPTY list is a ban — there is no owner to point at. */
  allowedIn: RegExp[];
  /** What to import instead. Omitted for a banned global, where nothing replaces it. */
  owner?: string;
  /** Why the capability has one door. Lands in the diagnostic. */
  why: string;
  /** Modules that hand the same capability out as a binding, for a dotted path only. */
  alsoImportedFrom?: RegExp;
};

const ENV_MODULE = /\/src\/env\.[tj]s$/;
const API_CLIENT_MODULE = /\/src\/infrastructure\/api-client\.[tj]s$/;
const BROWSER_STORAGE_MODULE = /\/src\/infrastructure\/browser-storage\.[tj]s$/;

const RESTRICTED_AMBIENT_GLOBALS: AmbientGlobalPolicy[] = [
  {
    globalPath: "process.env",
    allowedIn: [ENV_MODULE],
    owner: "@/env",
    why: "The env module validates every variable once at boot, so a missing one fails there rather than as an undefined deep in a request.",
    alsoImportedFrom: /^(?:node:)?process$/,
  },
  {
    // The same capability under the bundler's spelling. A project on Vite alone can drop the
    // `process.env` entry above; a project on Node alone can drop this one. Neither can drop both
    // and still claim the env module is the only reader.
    globalPath: "import.meta.env",
    allowedIn: [ENV_MODULE],
    owner: "@/env",
    why: "The env module validates every variable once at boot, so a missing one fails there rather than as an undefined deep in a request.",
  },
  {
    globalPath: "fetch",
    allowedIn: [API_CLIENT_MODULE],
    owner: "@/infrastructure/api-client",
    why: "Base URL, auth headers, timeout and error decoding are decided once at the client; a bare fetch decides them again, differently, and usually omits the last one.",
  },
  {
    globalPath: "localStorage",
    allowedIn: [BROWSER_STORAGE_MODULE],
    owner: "@/infrastructure/browser-storage",
    why: "Key names, serialization, and the private-mode and server-render cases where the API is absent or throws belong in the wrapper, not at each call site.",
  },
];

// A global is reachable as a property of the global object, which is a different node shape for the
// same read. Stripped before matching, so one entry covers every host.
const GLOBAL_OBJECT_HOSTS = new Set(["globalThis", "global", "window", "self"]);

// `(process).env`, `process!.env` and `(globalThis as never).localStorage` are the same read with a
// node wedged in. Stepping through them is four lines; not stepping through them is a bypass that
// TypeScript syntax hands over for free.
const TRANSPARENT_WRAPPERS = new Set([
  "ParenthesizedExpression",
  "ChainExpression",
  "TSNonNullExpression",
  "TSAsExpression",
  "TSSatisfiesExpression",
  "TSTypeAssertion",
]);

/**
 * The name a member expression or object-pattern property reads, whichever way it is spelled.
 *
 * `process.env` and `process["env"]` are the same read and different nodes, and the computed form
 * is the one a linted codebase drifts toward. Resolving both through one helper is what keeps the
 * two spellings from needing two arms in every caller below.
 */
function staticKeyName(key: ESTree.Node, computed: boolean): string | undefined {
  if (!computed) return key.type === "Identifier" ? key.name : undefined;
  return key.type === "Literal" && typeof key.value === "string" ? key.value : undefined;
}

/**
 * Every identifier in the file that references an ambient global, and no identifier that does not.
 *
 * TWO sources, and a rule reading either one alone goes silent on half the projects that adopt it.
 * `through` holds the references scope analysis could not resolve, which is where a global lands
 * when the linter declares no environment. Configure `env: { browser: true }` and oxlint creates a
 * Variable for every browser global and RESOLVES those same references onto it — `through` comes
 * back empty, and a rule reading only `through` reports nothing in exactly the projects careful
 * enough to declare their environment. Those declared globals are the global-scope variables with
 * no definition; a variable WITH one is the file's own top-level binding shadowing the name, which
 * is not the ambient global.
 *
 * Working from references rather than from Identifier nodes is also what keeps `{ fetch: 1 }`,
 * `client.fetch()` and `interface X { fetch: T }` out with no position guards: a key, a property
 * and a type member are references to nothing, so they never appear here.
 */
function ambientGlobalReferences(sourceCode: SourceCode): Reference[] {
  const globalScope = sourceCode.scopeManager.globalScope;
  if (globalScope === null) return [];
  const declared = [...globalScope.set.values()].filter((variable) => variable.defs.length === 0);
  return [...globalScope.through, ...declared.flatMap((variable) => variable.references)];
}

/** The exporting module's name for a specifier, which is the one a local alias cannot change. */
function exportedName(name: ESTree.ModuleExportName): string {
  return name.type === "Literal" ? name.value : name.name;
}

/** The module specifier of a `require("…")` call, which an ImportDeclaration visitor never sees. */
function requiredSpecifier(node: ESTree.Node | null | undefined): string | undefined {
  if (node === null || node === undefined || node.type !== "CallExpression") return undefined;
  if (node.callee.type !== "Identifier" || node.callee.name !== "require") return undefined;
  const [argument] = node.arguments;
  if (argument === undefined || argument.type !== "Literal") return undefined;
  return typeof argument.value === "string" ? argument.value : undefined;
}

export const ambientGlobalsRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      ambientGlobalOutsideOwner:
        "Only {{owner}} reads `{{globalPath}}`. {{why}} Import it from there instead of reading the global here.",
      ambientGlobalReExported:
        "Re-exporting `{{globalPath}}` hands the capability to every importer of this module without the word appearing in their code. {{why}} Only {{owner}} may reach it.",
      bannedAmbientGlobal:
        "`{{globalPath}}` is not available in this codebase — no module owns it. {{why}}",
    },
  },
  create(context) {
    const { filename } = context;
    if (!filename.includes("/src/")) return {};
    if (isArchitectureExemptPath(filename)) return {};

    const enforced = RESTRICTED_AMBIENT_GLOBALS.filter(
      (policy) => !policy.allowedIn.some((allowed) => allowed.test(filename)),
    );
    if (enforced.length === 0) return {};

    // Roots are collected and walked at Program:exit rather than reported as they are found: the
    // scope analysis is a whole-file answer, and sorting by position keeps the diagnostics in
    // source order however the references were grouped.
    const roots: { node: ESTree.Node; path: string }[] = [];

    const restrictedFor = (path: string): AmbientGlobalPolicy | undefined =>
      path === "" ? undefined : enforced.find((policy) => policy.globalPath === path);

    // A banned global overrides whichever message the call site asked for: with no owner to import
    // from, "import it from there" and "only X may reach it" are both instructions to nowhere.
    const report = (
      node: ESTree.Node,
      policy: AmbientGlobalPolicy,
      messageId: "ambientGlobalOutsideOwner" | "ambientGlobalReExported",
    ) => {
      context.report({
        node,
        messageId: policy.allowedIn.length === 0 ? "bannedAmbientGlobal" : messageId,
        data: { globalPath: policy.globalPath, owner: policy.owner ?? "", why: policy.why },
      });
    };

    /** The path segments of a policy whose `alsoImportedFrom` covers this specifier. */
    const capabilitySegments = (
      policy: AmbientGlobalPolicy,
      specifier: string,
    ): string[] | undefined =>
      policy.alsoImportedFrom !== undefined && policy.alsoImportedFrom.test(specifier)
        ? policy.globalPath.split(".")
        : undefined;

    /**
     * Rebinds a module binding that IS the path's first segment, so reads through it rejoin the
     * ordinary member walk under the name the global would have had.
     */
    const rebindAsPathRoot = (declaration: ESTree.Node, localName: string, path: string) => {
      for (const variable of context.sourceCode.getDeclaredVariables(declaration)) {
        if (variable.name !== localName) continue;
        for (const reference of variable.references) {
          roots.push({ node: reference.identifier, path });
        }
      }
    };

    /**
     * Reports the properties of a destructure whose keys complete a restricted path.
     *
     * `basePath` is what the destructured object IS: the host's empty path for `const { fetch } =
     * window`, the first segment for `const { env } = require("node:process")`, and — for a bare
     * global whose module exports it by name — empty again, because the module namespace is not the
     * global's parent, its property is the global.
     */
    const reportDestructuredMembers = (pattern: ESTree.Node, basePath: string) => {
      if (pattern.type !== "ObjectPattern") return;
      for (const property of pattern.properties) {
        if (property.type !== "Property") continue;
        const key = staticKeyName(property.key, property.computed);
        if (key === undefined) continue;
        const policy = restrictedFor(basePath === "" ? key : `${basePath}.${key}`);
        if (policy !== undefined) report(property, policy, "ambientGlobalOutsideOwner");
      }
    };

    /**
     * Walks outward from a root, extending the read path one member at a time, and reports the
     * SHORTEST enclosing expression whose path is restricted. Shortest is what makes the span land
     * on `process.env` rather than on `process.env.STRIPE_KEY`, and what keeps a single read from
     * drawing a second diagnostic at every further property.
     */
    const reportAmbientRead = (root: ESTree.Node, rootPath: string) => {
      let node = root;
      let path = rootPath;
      for (;;) {
        const policy = restrictedFor(path);
        if (policy !== undefined) {
          report(node, policy, "ambientGlobalOutsideOwner");
          return;
        }

        const parent: ESTree.Node | null | undefined = node.parent;
        if (parent === null || parent === undefined) return;

        if (TRANSPARENT_WRAPPERS.has(parent.type) && "expression" in parent && parent.expression === node) {
          node = parent;
          continue;
        }

        if (parent.type === "MemberExpression" && parent.object === node) {
          const key = staticKeyName(parent.property, parent.computed);
          // A non-literal computed key names nothing this rule can match. Stop rather than guess.
          if (key === undefined) return;
          path = path === "" ? key : `${path}.${key}`;
          node = parent;
          continue;
        }

        // `const { env } = process` reads the same object without ever writing `process.env`, and
        // `const { env: cfg } = process` hides even the name — so this arm keys on the property,
        // not on the binding it introduces.
        if (parent.type === "VariableDeclarator" && parent.init === node) {
          reportDestructuredMembers(parent.id, path);
          return;
        }

        return;
      }
    };

    return {
      // `import.meta` is the one ambient root that is not an identifier — a MetaProperty, distinct
      // from the language's other one, `new.target`.
      MetaProperty(node) {
        if (node.meta.name === "import") roots.push({ node, path: "import.meta" });
      },

      // Importing the binding sidesteps every global-shaped check above.
      ImportDeclaration(node) {
        // A type-only import pulls in no runtime value, so it cannot read the capability.
        if (node.importKind === "type") return;
        for (const policy of enforced) {
          const segments = capabilitySegments(policy, node.source.value);
          if (segments === undefined) continue;
          const capabilityExport = segments[segments.length - 1];

          for (const specifier of node.specifiers) {
            if (specifier.type === "ImportSpecifier" && specifier.importKind === "type") continue;
            // A namespace or default binding IS the path's first segment under another name, so
            // reads through it are ordinary member reads and rejoin the same walk. `{ default as
            // proc }` is the default export wearing a named specifier's node shape, and comparing
            // it against the capability's export name — which is what it is NOT — lets it through.
            // Dotted paths only: a bare global has no segment above it to rebind, and treating the
            // module namespace as one would report every use of the module.
            const rebinds =
              specifier.type !== "ImportSpecifier" ||
              exportedName(specifier.imported) === "default";
            if (rebinds) {
              if (segments.length >= 2) rebindAsPathRoot(node, specifier.local.name, segments[0]);
              continue;
            }
            if (exportedName(specifier.imported) === capabilityExport) {
              report(specifier, policy, "ambientGlobalOutsideOwner");
            }
          }
        }
      },

      // `export { env } from "node:process"` launders the capability for every downstream importer
      // while this file stays clean of it — the same reach, one keyword over, and the only spelling
      // here that hands the global to code the rule will never see.
      ExportNamedDeclaration(node) {
        if (node.source === null || node.exportKind === "type") return;
        for (const policy of enforced) {
          const segments = capabilitySegments(policy, node.source.value);
          if (segments === undefined) continue;
          const capabilityExport = segments[segments.length - 1];

          for (const specifier of node.specifiers) {
            if (specifier.exportKind === "type") continue;
            const source = exportedName(specifier.local);
            if (source === capabilityExport || (segments.length >= 2 && source === "default")) {
              report(specifier, policy, "ambientGlobalReExported");
            }
          }
        }
      },

      ExportAllDeclaration(node) {
        if (node.exportKind === "type") return;
        for (const policy of enforced) {
          if (capabilitySegments(policy, node.source.value) === undefined) continue;
          // A star re-export republishes every export of the module under this file's name — the
          // one carrying the capability included — and names no specifier to blame.
          report(node.source, policy, "ambientGlobalReExported");
        }
      },

      // `const process = require("node:process")` is the CommonJS spelling of the same reach, and
      // no import visitor sees it.
      VariableDeclarator(node) {
        const specifier = requiredSpecifier(node.init);
        if (specifier === undefined) return;
        for (const policy of enforced) {
          const segments = capabilitySegments(policy, specifier);
          if (segments === undefined) continue;
          if (node.id.type === "ObjectPattern") {
            reportDestructuredMembers(node.id, segments.length >= 2 ? segments[0] : "");
            continue;
          }
          if (node.id.type === "Identifier" && segments.length >= 2) {
            rebindAsPathRoot(node, node.id.name, segments[0]);
          }
        }
      },

      "Program:exit"() {
        for (const reference of ambientGlobalReferences(context.sourceCode)) {
          const name = reference.identifier.name;
          roots.push({
            node: reference.identifier,
            path: GLOBAL_OBJECT_HOSTS.has(name) ? "" : name,
          });
        }
        roots.sort((left, right) => left.node.range[0] - right.node.range[0]);
        for (const root of roots) reportAmbientRead(root.node, root.path);
      },
    };
  },
});
