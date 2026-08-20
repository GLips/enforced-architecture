// ─── boundary/ambient-globals ────────────────────────────────────────
//
// Makes sure: `process.env`, `import.meta.env`, `fetch` and `localStorage` are
// read in one module each: @/env, the API client, and the browser storage
// wrapper. To give every request a timeout, or every stored key one name and one
// format, you edit one file. A missing variable fails at boot in @/env, and not
// as an undefined deep inside a request.
//
// A global is never imported, so no rule that reads specifiers can fence one.
// This is the rule for a capability that the module graph does not mention.
//
// Write `globalPath` HOST-FREE: `localStorage`, not `window.localStorage`. The
// rule strips `window`, `globalThis`, `self` and `global` before it matches, so
// one entry covers every host spelling and the computed forms. A dotted path
// (`process.env`) matches that prefix and everything under it.
//
// `alsoImportedFrom` covers a capability that a module also exports, where the
// module spelling avoids every check that matches a global. The re-export is the
// one to understand: `export { env } from "node:process"` gives the capability
// to every importer of this module, and the file that writes it reads nothing.
//
// A global that is not on the list is unrestricted. Keep the list to the
// capabilities with a real owner; a longer one teaches people the rule is
// arbitrary, and that is what gets it disabled.
//
// Adopt this entry for `fetch` or `react/no-direct-fetch`, and not both. That
// rule bans `fetch` in `.tsx` and leaves every `.ts` file alone, for a project
// with no typed client. Both together report two diagnostics that say different
// things about one violation.
//
// Scope is `/src/`, so vite.config.ts and next.config.js are unaffected. What
// the BUILD reads is a different question from what value the app reads at
// runtime, and one exemption for both gets reused for runtime code.
//
// The rule resolves references, so a local binding that shadows the name,
// `client.fetch()` and `{ fetch: 1 }` are not reads. A rebound host
// (`const g = globalThis; g.localStorage`) and a computed key that is not a
// string literal are not matched: nothing per-file can follow either one. A
// type-only import is erased and reads nothing.
//
// Where `alsoImportedFrom` names a module for a DOTTED path — which is what
// that field is for — every spelling that reaches it is one read: a named,
// default or namespace import, `import x = require()`, `require()` and
// `await import()`, bound, destructured, or read straight off the load
// expression. On a bare `globalPath` the field is half-supported: the spellings
// that NAME the export are caught, and every spelling that hands over the module
// OBJECT is not — a bare global has no segment above it for the module to stand
// in for. What is NOT followed is the capability passed on as a
// value (`f(process)`), a module bound by assignment rather than declaration,
// and `import("node:process").then(({ env }) => …)`, where the name is a
// callback parameter and following it means following the promise. The module
// spellings share lib/imported-names.ts with the two style rules that fence on
// names, so its blind spots — chiefly a specifier that is not a literal or a
// substitution-free template — are this rule's too.
// ──────────────────────────────────────────────────────────────────────

import {
  defineRule,
  type ESTree,
  type Reference,
  type SourceCode,
} from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";
import { exportedName, runtimeImportSpecifier } from "../lib/imported-names.ts";
import { staticKeyName } from "../lib/static-key-name.ts";
import {
  isTransparentWrapper,
  outermostTransparentWrapper,
} from "../lib/transparent-wrappers.ts";

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
     * Records a read taken straight off a load expression, which binds no name for the reference
     * walk to find: `(await import("node:process")).env`, `require("node:process").env`.
     */
    const pushUnboundLoadRoot = (node: ESTree.Node) => {
      const specifier = runtimeImportSpecifier(node, context.sourceCode);
      if (specifier === undefined) return;
      // `(require("node:process") as never).env` is the same read with a TypeScript node wedged in.
      const loaded = outermostTransparentWrapper(node);
      const parent: ESTree.Node | null | undefined = loaded.parent;
      if (parent === null || parent === undefined) return;
      if (parent.type !== "MemberExpression" || parent.object !== loaded) return;
      for (const policy of enforced) {
        const segments = capabilitySegments(policy, specifier);
        // Dotted paths only, the same cut the import and import-equals arms make. A bare global has
        // no segment above it, so the module object would have to enter the walk at the empty path
        // — and the shipped table pairs `alsoImportedFrom` with no bare path, which would leave
        // that arm unreachable by any fixture. Bare-path support is one decision, taken in all
        // three arms at once with fixtures, not a branch waiting here for a table that may come.
        if (segments === undefined || segments.length < 2) continue;
        roots.push({ node: loaded, path: segments[0] });
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

        if (isTransparentWrapper(parent) && parent.expression === node) {
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

      // `(await import("node:process")).env` and `require("node:process").env` load the module and
      // read the capability in one expression, binding nothing — so no declaration and no
      // reference names either, and only the AST has them. Restricted to the member read: the
      // spellings that DO bind a name belong to the VariableDeclarator arm below, and two arms
      // reaching one read report it twice.
      ImportExpression(node) {
        // The read hangs off the AWAIT, not the import — and a cast may sit between the two
        // (`await (import("node:process") as never)`), so the await is found from the outermost
        // wrapper rather than from the import's own parent.
        const loaded = outermostTransparentWrapper(node);
        pushUnboundLoadRoot(loaded.parent?.type === "AwaitExpression" ? loaded.parent : node);
      },

      CallExpression(node) {
        pushUnboundLoadRoot(node);
      },

      // `import process = require("node:process")` binds the module and reaches no
      // ImportDeclaration. Only the rebinding is needed — a type-only import-equals can be read
      // only in type position, which is a TSQualifiedName the member walk never matches, so it
      // falls out with no `importKind` guard.
      TSImportEqualsDeclaration(node) {
        if (node.moduleReference.type !== "TSExternalModuleReference") return;
        const specifier = node.moduleReference.expression.value;
        for (const policy of enforced) {
          const segments = capabilitySegments(policy, specifier);
          if (segments !== undefined && segments.length >= 2) {
            rebindAsPathRoot(node, node.id.name, segments[0]);
          }
        }
      },

      // `const process = require("node:process")` is the CommonJS spelling of the same reach, and
      // `const { env } = await import("node:process")` is the ESM one. No import visitor sees
      // either.
      VariableDeclarator(node) {
        const specifier = runtimeImportSpecifier(node.init, context.sourceCode);
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
        // NO SPEC PINS THIS SORT, and one cannot: `RuleTester` sorts a rule's diagnostics by span
        // before comparing, so under the harness the ordering is right either way. The oxlint CLI
        // emits in report order, which is why it is here. Delete it and every spec stays green.
        roots.sort((left, right) => left.node.range[0] - right.node.range[0]);
        for (const root of roots) reportAmbientRead(root.node, root.path);
      },
    };
  },
});
