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
// module spelling avoids every check that matches a global. It is a LIST of
// module names — `["node:process", "process"]`, matched exactly — and every
// spelling of the module that a project actually writes is a row rather than a
// pattern to be widened later. The re-export is the one to understand:
// `export { env } from "node:process"` gives the capability to every importer of
// this module, and the file that writes it reads nothing.
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
// object stands in for the segments above the capability, and a bare path has no
// segment above it.
//
// NONE of those spellings is walked here. `lib/imported-names.ts` owns every one
// of them, for this rule and for the two style rules that fence on names, and
// this rule asks it the same question they do — which names does this file take
// from these modules — then matches the answer against the last segment of each
// `globalPath`. So its blind spots are this rule's: a specifier that is not a
// literal or a substitution-free template, a computed key that is not a string
// literal, a module bound by assignment rather than declaration, a destructure
// that binds no name at all, the INNER name of a nested destructure — for the
// `process.env` row `const { env: { KEY } } = …` reports, because `env` is the
// key the module hands over and the row's capability; a row whose capability sat
// at the inner name instead would not — and
// `import("node:process").then(({ env }) => …)`, where the name is a callback
// parameter and following it means following the promise. The capability passed
// on as a value (`f(process)`) is not followed either, by that file or this one.
//
// DEPTH is not a blind spot, and the arithmetic holds at any: the module object
// stands in for every segment of the `globalPath` above the LAST, so a row
// `a.b.c` makes `require("m").c` the read and `require("m").a` nothing. This is
// the one place the module spellings and the global walk describe the path
// differently — the global walk matches `a.b.c` whole — and they agree on which
// read is the capability, which is what matters. Every arm answers through
// `capabilityExport` so there is one answer rather than one per arm; the
// previous regex-selected version had two arms disagreeing about it, and no row
// deep enough to show it.
//
// Re-exports are the one module spelling this file still walks itself. That file
// answers what a module hands to THIS file; a re-export hands it to code neither
// of them sees, and both the blame node and the message differ.
//
// A module spelling not in the list is not covered, and there is no near-miss
// matching: a wrapper package that re-exports `env` under its own name, a
// subpath, or a bundler alias reaches the capability and reports nothing. That
// is the price of the list being enumerable, and it is the right price — the
// alternative is a pattern, which an adopter widens until the capability has no
// owner. Add the spelling as a row.
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
import type { ESTree, Reference, SourceCode } from "@oxlint/plugins";
import { type FileRole, isModule } from "../../policy/declared-trees.ts";
import type { TreeVocabulary } from "../../policy/layout.ts";
import { exportedName, visitImportedNames } from "../lib/imported-names.ts";
import { sourceOrderedReports } from "../lib/source-ordered-reports.ts";
import { staticKeyName } from "../lib/static-key-name.ts";
import { isTransparentWrapper } from "../lib/transparent-wrappers.ts";

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
 * The module object stands in for the segments above the capability — `require("node:process")` is
 * `process`, so `.env` off it is `process.env`. A bare path has no segment above it, so there is
 * nothing for the module to be, and `capabilityExport` below would be the whole path: every read
 * of a name equal to the global would report, from any listed module. Five arms once carried a
 * `segments.length >= 2` cut for that case which no fixture could reach, and they did not all
 * agree. Making the pairing unwritable deletes the cut instead of repeating it.
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
        /**
         * Modules that hand the same capability out as a binding, spelled out one by one.
         *
         * A LIST, never a pattern. `/^(?:node:)?process$/` said the same thing this row's two
         * strings say, and cost the rule its share of `lib/imported-names.ts`: a module set
         * matched by predicate cannot be handed to a helper that selects by name, so the rule
         * carried a private copy of the module walk, and the copy is how a cast inside an `await`
         * escaped it while the two style rules caught it. The knob was also an off-switch in a
         * costume — a pattern is the one config shape an adopter can widen until the capability
         * has no owner at all, which is the thing this catalog's posture rules out.
         *
         * Matched EXACTLY, so every spelling that reaches the module is a row: `process` and
         * `node:process` are both here. A wrapper package that re-publishes the capability under
         * its own name is not covered and is not meant to be — see the header.
         */
        alsoImportedFrom: readonly string[];
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
      alsoImportedFrom: ["node:process", "process"],
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

/**
 * The export that IS the capability: the last segment of the `globalPath`.
 *
 * The module object stands in for every segment ABOVE it — `require("node:process")` is `process`,
 * so `env` off it is `process.env`, and for a row `a.b.c` the module would be `a.b`. That is the
 * arithmetic `lib/imported-names.ts` forces: it hands over ONE key read off a module binding,
 * whatever the depth of the path that key completes. THE ONLY ANSWER in the file, deliberately —
 * every arm that needs it calls this, because the regex-selected version it replaced computed the
 * module's stand-in from the FIRST segment in its member walk and the export from the LAST in its
 * specifier arm, and no row was deep enough for the two to be seen disagreeing. Answered for a
 * bare `globalPath` too,
 * where it is the whole path: harmless, because the policy type admits `alsoImportedFrom` only
 * beside a dotted one, so no bare row is ever looked up by specifier.
 */
function capabilityExport(policy: AmbientGlobalPolicy): string {
  return policy.globalPath.slice(policy.globalPath.lastIndexOf(".") + 1);
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

    // Every module any enforced policy names — the one set `visitImportedNames` is asked about.
    // NOT deduplicated, and a `new Set` here would be a guard that cannot change an answer dressed
    // as one that can: the consumer asks `includes`, which is indifferent to a repeat. Nor is the
    // empty case guarded — an empty list is the helper's own answer that no specifier matches.
    const capabilityModules = enforced.flatMap((policy) => policy.alsoImportedFrom ?? []);

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

    /** The enforced policies whose `alsoImportedFrom` names this module. */
    const policiesImportedFrom = (specifier: string): AmbientGlobalPolicy[] =>
      enforced.filter((policy) => policy.alsoImportedFrom?.includes(specifier) === true);

    /**
     * Reports the properties of a destructure whose keys complete a restricted path.
     *
     * `basePath` is what the destructured object IS, and it only ever comes from the GLOBAL walk:
     * the host's empty path for `const { fetch } = window`, and the read so far for
     * `const { env } = process`. The module spellings of the same destructure —
     * `const { env } = require("node:process")` — are `lib/imported-names.ts`'s, which hands over
     * the key rather than the pattern, so nothing here has a module case to answer.
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

      // Importing the binding sidesteps every global-shaped check above — and the module spellings
      // that reach it are `lib/imported-names.ts`'s whole subject, so this rule asks it rather
      // than walking them. `env` from `node:process` is `View` from `react-native` with a
      // different consequence: one name, taken from a named module, under the exporting module's
      // own spelling.
      //
      // ONE call, with every module any enforced policy names. A second call would give the
      // spread a second `Program` key and silently drop the first one's whole scope sweep.
      ...visitImportedNames(context.sourceCode, capabilityModules, (name, node, specifier) => {
        const policy = policiesImportedFrom(specifier).find(
          (candidate) => capabilityExport(candidate) === name,
        );
        if (policy !== undefined) report(node, policy, "ambientGlobalOutsideOwner");
      }),

      // `export { env } from "node:process"` launders the capability for every downstream importer
      // while this file stays clean of it — the same reach, one keyword over, and the only spelling
      // here that hands the global to code the rule will never see — which is also why
      // `lib/imported-names.ts` does not answer for it, and this arm walks the specifiers itself.
      ExportNamedDeclaration(node) {
        if (node.source === null || node.exportKind === "type") return;
        for (const policy of policiesImportedFrom(node.source.value)) {
          for (const specifier of node.specifiers) {
            if (specifier.exportKind === "type") continue;
            // `export { default as proc }` re-exports the module object, which IS the segment above
            // the capability — so it launders the capability exactly as the named export does.
            const source = exportedName(specifier.local);
            if (source === capabilityExport(policy) || source === "default") {
              report(specifier, policy, "ambientGlobalReExported");
            }
          }
        }
      },

      ExportAllDeclaration(node) {
        if (node.exportKind === "type") return;
        for (const policy of policiesImportedFrom(node.source.value)) {
          // A star re-export republishes every export of the module under this file's name — the
          // one carrying the capability included — and names no specifier to blame.
          report(node.source, policy, "ambientGlobalReExported");
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
