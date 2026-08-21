// ─── boundary/ambient-globals ────────────────────────────────────────
//
// Makes sure: `process.env`, `import.meta.env`, `fetch` and `localStorage` are
// read in one module each: the tree's env modules, its API client, and its
// browser storage wrapper. To give every request a timeout, or every stored key
// one name and one format, you edit one file. A missing variable fails at boot
// in the env module, and not as an undefined deep inside a request.
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
// This rule is the SOLE owner of `fetch`, in every file of every declared tree,
// and the catalog holds no second fence for it. The `fetch` row's `why` is the
// whole fix instruction, which is why it names the request concerns AND the
// caching one: two components asking for the same data through the owner make
// one request and share one cache entry, and that is the value a component-only
// ban was there for.
//
// Do not add a `.tsx`-only companion beside it. The natural way to write one is
// to match the callee NAME, which reports `const fetch = useFetcher()` and
// `function Row({ fetch })` and goes silent on `globalThis["fetch"]` and
// `(globalThis as never).fetch` — the four rows the reference walk below gets
// right. Two fences on one global also report two diagnostics naming two
// different destinations for one violation.
//
// Scope is the declared trees, so vite.config.ts and next.config.js are
// unaffected — they sit outside every one of them. What the BUILD reads is a
// different question from what value the app reads at runtime, and one
// exemption for both gets reused for runtime code.
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
// expression. A bare `globalPath` gets no `alsoImportedFrom` at all, and the
// policy type refuses the pairing rather than half-honouring it: the module
// object stands in for the segment above the capability, and a bare path has no
// segment above it. What is NOT followed is the capability passed on as a
// value (`f(process)`), a module bound by assignment rather than declaration,
// and `import("node:process").then(({ env }) => …)`, where the name is a
// callback parameter and following it means following the promise. The module
// spellings share lib/imported-names.ts with the two style rules that fence on
// names, so its blind spots — chiefly a specifier that is not a literal or a
// substitution-free template — are this rule's too.
//
// SCOPE, and it is the same for every TREE-SCOPED rule in this catalog — which
// is every rule but `testing/no-module-mocking`, whose subject is a test file and
// which is therefore enabled globally. This rule is silent outside the declared
// trees, and silent on the files `isArchitectureExemptSourcePath` names inside
// them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ──────────────────────────────────────────────────────────────────────

import { apiClientModule, browserStorageModule } from "../../policy/layout.ts";
import { defineTreeRule } from "../lib/define-tree-rule.ts";
import {
  defineRule,
  type ESTree,
  type Reference,
  type SourceCode,
} from "@oxlint/plugins";
import { type FileRole, isModule } from "../../policy/declared-trees.ts";
import type { TreeVocabulary } from "../../policy/layout.ts";
import {
  exportedName,
  runtimeImportSpecifier,
  visitUnboundModuleObjects,
} from "../lib/imported-names.ts";
import { sourceOrderedReports } from "../lib/source-ordered-reports.ts";
import { staticKeyName } from "../lib/static-key-name.ts";
import {
  isTransparentWrapper,
  outermostTransparentWrapper,
} from "../lib/transparent-wrappers.ts";

type AmbientGlobalPolicyBase = {
  /**
   * Modules permitted to touch it, as paths from the tree's source root with no
   * extension. An EMPTY list is a ban — there is no owner to point at.
   *
   * Whole module paths rather than regexes: an `api-client-legacy.ts` beside the
   * owner must not inherit its permission, and a regex is the shape that lets an
   * adopter widen the owner set until the capability has no owner at all.
   */
  allowedIn: string[];
  /** What to import instead. Omitted for a banned global, where nothing replaces it. */
  owner?: string;
  /** Why the capability has one door. Lands in the diagnostic. */
  why: string;
};

/**
 * `alsoImportedFrom` is available only on a DOTTED `globalPath`, and the type is what says so.
 *
 * The module object stands in for the segment above the capability — `require("node:process")` is
 * `process`, so `.env` off it is `process.env`. A bare path has no segment above it, so there is
 * nothing for the module to be, and every arm below would need a second answer for the case. Five
 * arms once carried a `segments.length >= 2` cut for it that no fixture could reach, and they did
 * not all agree. Making the pairing unwritable deletes the cut instead of repeating it.
 */
type AmbientGlobalPolicy = AmbientGlobalPolicyBase &
  (
    | {
        /**
         * The read as it is spelled in source, host-free: `fetch`, `import.meta.env`. Dotted or
         * not — the branches split on whether a module also hands the capability out, not on the
         * shape of the path.
         */
        globalPath: string;
        alsoImportedFrom?: never;
      }
    | {
        /** The read as it is spelled in source, host-free: `process.env`. */
        globalPath: `${string}.${string}`;
        /** Modules that hand the same capability out as a binding. */
        alsoImportedFrom: RegExp;
      }
  );

/**
 * The capability owners, in the resolved tree's own vocabulary.
 *
 * EVERY env module is an owner of the env reads, not just the one spelled
 * `env.ts`. A project on the split option puts its secrets in `env.server.ts`,
 * and a rule naming one spelling reports the very module the message tells the
 * reader to move the read into.
 */
function restrictedAmbientGlobals(vocabulary: TreeVocabulary): AmbientGlobalPolicy[] {
  const envModules = Object.keys(vocabulary.envModules);
  const envOwner = envModules[0] ?? "";
  const envWhy =
    "The env module validates every variable once at boot, so a missing one fails there rather than as an undefined deep in a request.";
  const alias = (module: string) => `${vocabulary.aliasPrefix}${module}`;

  return [
    {
      globalPath: "process.env",
      allowedIn: envModules,
      owner: alias(envOwner),
      why: envWhy,
      alsoImportedFrom: /^(?:node:)?process$/,
    },
    {
      // The same capability under the bundler's spelling. A project on Vite alone can drop the
      // `process.env` entry above; a project on Node alone can drop this one. Neither can drop both
      // and still claim the env module is the only reader.
      globalPath: "import.meta.env",
      allowedIn: envModules,
      owner: alias(envOwner),
      why: envWhy,
    },
    {
      globalPath: "fetch",
      allowedIn: [apiClientModule(vocabulary)],
      owner: alias(apiClientModule(vocabulary)),
      why: "Base URL, auth headers, timeout and error decoding are decided once at the client; a bare fetch decides them again, differently, and usually omits the last one. Two callers that ask for the same data through the client also make one request and share one cache entry.",
    },
    {
      globalPath: "localStorage",
      allowedIn: [browserStorageModule(vocabulary)],
      owner: alias(browserStorageModule(vocabulary)),
      why: "Key names, serialization, and the private-mode and server-render cases where the API is absent or throws belong in the wrapper, not at each call site.",
    },
  ];
}

/** True when `role` is one of the modules a policy names as an owner. */
function isOwnerModule(role: FileRole, policy: AmbientGlobalPolicy): boolean {
  return policy.allowedIn.some((module) => isModule(role, module));
}

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

export const ambientGlobalsRule = defineTreeRule({
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
  create(context, role) {

    const enforced = restrictedAmbientGlobals(role.tree.vocabulary).filter(
      (policy) => !isOwnerModule(role, policy),
    );
    if (enforced.length === 0) return {};

    // Roots are collected and walked at Program:exit rather than reported as they are found: the
    // scope analysis is a whole-file answer, and sorting by position keeps the diagnostics in
    // source order however the references were grouped.
    // Every arm reports through this, including the ones that could be in order on their own:
    // half a rule buffering is what scrambles the other half.
    const ordered = sourceOrderedReports(context);

    const roots: { node: ESTree.Node; path: string }[] = [];

    // NO empty-path special case, though both callers do pass `""`: `reportAmbientRead` starts
    // every host read there (`window.fetch` arrives with the host's empty path), and
    // `reportDestructuredMembers` gets one from code as ordinary as `const { "": x } = window`.
    // It would
    // decide nothing. Every `globalPath` comes from `restrictedAmbientGlobals` below, whose four
    // values are string literals and none of them empty, so the lookup already answers `undefined`
    // for `""` — and a guard that cannot change an answer reads as one that can.
    const restrictedFor = (path: string): AmbientGlobalPolicy | undefined =>
      enforced.find((policy) => policy.globalPath === path);

    // A banned global overrides whichever message the call site asked for: with no owner to import
    // from, "import it from there" and "only X may reach it" are both instructions to nowhere.
    const report = (
      node: ESTree.Node,
      policy: AmbientGlobalPolicy,
      messageId: "ambientGlobalOutsideOwner" | "ambientGlobalReExported",
    ) => {
      ordered.report({
        node,
        messageId: policy.allowedIn.length === 0 ? "bannedAmbientGlobal" : messageId,
        data: { globalPath: policy.globalPath, owner: policy.owner ?? "", why: policy.why },
      });
    };

    /**
     * The two ends of a dotted path whose `alsoImportedFrom` covers the specifier: the segment the
     * MODULE stands in for (`process` for `require("node:process")`), and the export that IS the
     * capability (`env`).
     *
     * Never empty. The policy type admits `alsoImportedFrom` only beside a dotted `globalPath`, so
     * a matched policy always has a segment above its capability.
     */
    const importedCapability = (
      policy: AmbientGlobalPolicy,
      specifier: string,
    ): { moduleStandsFor: string; capabilityExport: string } | undefined => {
      if (policy.alsoImportedFrom === undefined || !policy.alsoImportedFrom.test(specifier)) {
        return undefined;
      }
      // No fallback on either end. The type admits `alsoImportedFrom` only beside a dotted path,
      // so both sides of the first `.` are non-empty, and a `?? ""` here would be a branch no
      // input reaches dressed up as a decision.
      return {
        moduleStandsFor: policy.globalPath.slice(0, policy.globalPath.indexOf(".")),
        capabilityExport: policy.globalPath.slice(policy.globalPath.lastIndexOf(".") + 1),
      };
    };

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
     *
     * `lib/imported-names.ts` owns the walk that finds `moduleObject`. It used to be a copy here,
     * and the copy is how a cast inside the await escaped this rule while the two style rules
     * caught it.
     */
    const pushUnboundLoadRoot = (specifier: string, moduleObject: ESTree.Node) => {
      for (const policy of enforced) {
        const capability = importedCapability(policy, specifier);
        if (capability === undefined) continue;
        roots.push({ node: moduleObject, path: capability.moduleStandsFor });
      }
    };

    /**
     * Reports the properties of a destructure whose keys complete a restricted path.
     *
     * `basePath` is what the destructured object IS: the host's empty path for `const { fetch } =
     * window`, and the segment the module stands in for — `process` — for
     * `const { env } = require("node:process")`. Both callers pass one of those two; there is no
     * third case, because a bare `globalPath` cannot carry `alsoImportedFrom`.
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
          const capability = importedCapability(policy, node.source.value);
          if (capability === undefined) continue;

          for (const specifier of node.specifiers) {
            if (specifier.type === "ImportSpecifier" && specifier.importKind === "type") continue;
            // A namespace or default binding IS the path's first segment under another name, so
            // reads through it are ordinary member reads and rejoin the same walk. `{ default as
            // proc }` is the default export wearing a named specifier's node shape, and comparing
            // it against the capability's export name — which is what it is NOT — lets it through.
            const rebinds =
              specifier.type !== "ImportSpecifier" ||
              exportedName(specifier.imported) === "default";
            if (rebinds) {
              rebindAsPathRoot(node, specifier.local.name, capability.moduleStandsFor);
              continue;
            }
            if (exportedName(specifier.imported) === capability.capabilityExport) {
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
          const capability = importedCapability(policy, node.source.value);
          if (capability === undefined) continue;

          for (const specifier of node.specifiers) {
            if (specifier.exportKind === "type") continue;
            // `export { default as proc }` re-exports the module object, which IS the segment above
            // the capability — so it launders the capability exactly as the named export does.
            const source = exportedName(specifier.local);
            if (source === capability.capabilityExport || source === "default") {
              report(specifier, policy, "ambientGlobalReExported");
            }
          }
        }
      },

      ExportAllDeclaration(node) {
        if (node.exportKind === "type") return;
        for (const policy of enforced) {
          if (importedCapability(policy, node.source.value) === undefined) continue;
          // A star re-export republishes every export of the module under this file's name — the
          // one carrying the capability included — and names no specifier to blame.
          report(node.source, policy, "ambientGlobalReExported");
        }
      },

      // `(await import("node:process")).env` and `require("node:process").env` load the module and
      // read the capability in one expression, binding nothing — so no declaration and no
      // reference names either, and only the AST has them. The shared walk is restricted to the
      // member read: the spellings that DO bind a name belong to the VariableDeclarator arm below,
      // and two arms reaching one read report it twice.
      ...visitUnboundModuleObjects(context.sourceCode, pushUnboundLoadRoot),

      // `import process = require("node:process")` binds the module and reaches no
      // ImportDeclaration. Only the rebinding is needed — a type-only import-equals can be read
      // only in type position, which is a TSQualifiedName the member walk never matches, so it
      // falls out with no `importKind` guard.
      TSImportEqualsDeclaration(node) {
        if (node.moduleReference.type !== "TSExternalModuleReference") return;
        const specifier = node.moduleReference.expression.value;
        for (const policy of enforced) {
          const capability = importedCapability(policy, specifier);
          if (capability !== undefined) {
            rebindAsPathRoot(node, node.id.name, capability.moduleStandsFor);
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
          const capability = importedCapability(policy, specifier);
          if (capability === undefined) continue;
          if (node.id.type === "ObjectPattern") {
            reportDestructuredMembers(node.id, capability.moduleStandsFor);
            continue;
          }
          if (node.id.type === "Identifier") {
            rebindAsPathRoot(node, node.id.name, capability.moduleStandsFor);
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
        // No sort here: `roots` is half the rule's diagnostics, and ordering half of them is what
        // scrambles the other half. `lib/source-ordered-reports.ts` sees all of them.
        for (const root of roots) reportAmbientRead(root.node, root.path);
        ordered.flushInSourceOrder();
      },
    };
  },
});
