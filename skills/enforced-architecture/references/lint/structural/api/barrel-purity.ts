// ─── api/barrel-purity ────────────────────────────────────────────────
//
// Makes sure: No client-safe barrel in domains/*/index.ts or features/*/index.ts
// reaches a server-only package through its re-exports. A client component or a
// route file can import any barrel, and you do not first read the chain below it.
// When a chain does reach one, the finding at commit time names the barrel to
// change, not the last package in a build log.
//
// This check does not use the resolved import graph. Graph resolution discards
// bare package specifiers as "not a boundary question", and bare package names
// are the subject of this check. It shares the extraction instead, through
// scanDeclaredImports.
//
// Do not add the pass that recovers "import type" edges. Both Bun scans erase
// those edges, and this check wants that erasure. A type-only import makes no
// runtime code and cannot put a package in the client bundle. A mixed re-export
// (export { type Foo, bar } from "…") stays, because bar is a runtime dependency.
//
// ── The server-function boundary: a stated approximation ─────────────────────
//
// The trace stops at a module that crosses the framework's server-function
// boundary, because the compiler cuts the chain there. Deciding whether a given
// module crosses it is a question about SYNTAX — which name an import bound,
// whether the call reaches that binding or a shadow — and this tier has no
// parser for that. What follows is the approximation, its contract, and why it
// is not going to be replaced by a better parser or a bigger regex.
//
// IN — recognised as a boundary. A named import of one of the boundary's calls
// from the boundary's module, read as `imported as local` so the alias direction
// is not guessable, plus a call of that local name in the body, plus no
// binding-shaped occurrence of that name anywhere else in the file. A namespace
// import counts, as `NS.createServerFn`.
//
// OUT — deliberately not recognised, and OUT MEANS THE TRACE CONTINUES. Every
// omission here is an over-report: a chain the framework would have cut, reported
// as a blocking error. That is the safe direction and it is chosen. A boundary
// reached through a local re-export is out. A file that imports the boundary for
// real and also mentions the name in a binding-shaped position — `{ createServerFn }`
// in an object literal, the name passed as an argument — reads as having rebound
// it and is out. A rest binding is out, and `rebindsName` says why.
//
// NEVER — the direction that would be a false NEGATIVE, a server-only package in
// the client bundle behind a green run. No spelling is accepted as a boundary
// without an import of the boundary's own module. `rebindsName` is one-sided for
// exactly this reason: any doubt about which binding runs resolves to "not a
// boundary", never to "boundary".
//
// WHY IT STAYS AN APPROXIMATION. `placement/no-plain-export-in-server-fn-module`
// reads the same syntax EXACTLY, with a real AST: it decides bridge-ness from the
// initializer's call chain, and it reports four of the six shadow fixtures below
// on its own. It does NOT report `impostor` or `sconce`, whose exports ARE
// bridge-shaped chains over a name that is not the framework's — the two cases
// where the binding, not the shape, is the whole question. So it cannot be the
// only owner, and neither can it be replaced by this: its subject is one file and
// the consumer of this answer is a cross-file trace the oxlint tier cannot run.
// The two are jointly actionable — that rule says "make this export a bridge or
// move it", this one says "move the export to the server barrel or put it behind
// a server function", and following either never violates the other.
//
// So this is a second, deliberately WEAKER reading of a question another rule
// owns exactly. Treat further bypasses of it as the known approximation this
// paragraph names, not as bugs to patch one spelling at a time. Four rounds of
// review found four spellings; a fifth is not evidence the design is wrong, it is
// the design. The thing that would change the design is a real parser in THIS
// tier — `oxc-parser` is the candidate, and it is declined here because it is a
// native `0.x` dependency with no version line to oxlint's 1.x, shipped into
// every adopting project for one call site.
//
// ──────────────────────────────────────────────────────────────────────

import { statSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import {
  packageNameOf,
  SOURCE_EXTENSIONS,
  subdividedDirs,
  type TreeVocabulary,
} from "../../policy/layout.ts";
import { scanDeclaredImports } from "../import-graph.ts";
import {
  blankComments,
  collectTreeFiles,
  lineNumberAt,
  lineStartOffsets,
  readFile,
  toProjectPath,
  type Finding,
  type StructuralCheck,
  type TreeContext,
} from "../check-substrate.ts";

/**
 * Every specifier the file imports AT RUNTIME.
 *
 * The scan itself is the tier's shared one — see `scanDeclaredImports`. Only the
 * collapse to a SET is local: this check asks whether a package is reachable,
 * never how many times, so the graph's occurrence counting has nothing to
 * contribute here.
 *
 * Both of Bun's scans ERASE `import type`, and here that erasure is exactly the
 * semantics wanted: a type-only import emits no runtime code and cannot break a
 * client bundle. This is the inverse of the graph's problem, which has to work
 * to recover those edges. Do not reach for its reveal pass. A mixed re-export
 * (`export { type Foo, bar } from "…"`) survives, because `bar` is a runtime
 * dependency and the chain below it is real.
 */
function runtimeSpecifiers(absolute: string, source: string, jsxImportSource: string): string[] {
  const scanned = scanDeclaredImports({ path: absolute, source, jsxImportSource });
  return [...new Set(scanned.map((entry) => entry.path))];
}

/**
 * Tried in order, and the order is the approximation: an exact path wins, then
 * the extensions, then the directory barrel. This stands in for TypeScript's
 * module resolution without the compiler API, and its gaps are named in every
 * message this check emits — a specifier it cannot resolve ends a trace silently.
 *
 * The directory-barrel forms are spelled from the tree's own barrel module, so a
 * tree calling its barrel something other than `index` still resolves the hop.
 */
function resolutionSuffixes(vocabulary: TreeVocabulary): string[] {
  const barrel = vocabulary.clientBarrelModule;
  return [
    "",
    ...SOURCE_EXTENSIONS.map((extension) => `.${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => `/${barrel}.${extension}`),
  ];
}

/**
 * Where an internal specifier lands, or undefined when it is not internal.
 *
 * Aliased specifiers are followed as well as relative ones. They are the same
 * edge written differently, and following only relative ones ends the trace at
 * the first `@/shared/…` hop and reports the barrel clean.
 */
function resolveTracedImport(
  context: TreeContext,
  fromFile: string,
  specifier: string,
): string | undefined {
  const { aliasPrefix } = context.vocabulary;
  const base = specifier.startsWith(aliasPrefix)
    ? resolve(context.sourceRoot, specifier.slice(aliasPrefix.length))
    : specifier.startsWith(".")
      ? resolve(dirname(fromFile), specifier)
      : undefined;

  if (base === undefined) return undefined;

  for (const suffix of resolutionSuffixes(context.vocabulary)) {
    const candidate = `${base}${suffix}`;
    // `isFile` matters for the empty suffix: a specifier naming a directory
    // exists on disk and is not a module.
    if (statSync(candidate, { throwIfNoEntry: false })?.isFile() === true) return candidate;
  }
  return undefined;
}

const RESOLUTION_NOTE =
  `Resolution here tries the exact path, then every source extension, then the\n` +
  `directory barrel under each. It does not SUBSTITUTE extensions the way TypeScript\n` +
  `does (./target.js → target.ts), so a hop spelled that way ends the trace without\n` +
  `a word.`;

/**
 * True when `specifier` reaches a package that cannot be in a client bundle.
 *
 * The `node:` arm is not configurable and does not belong in the list: a Node
 * builtin in a barrel every client component may import is server-only by
 * construction, not by a project's opinion about its dependencies. Everything
 * else is compared by package NAME, so `drizzle-orm/pg-core` is `drizzle-orm`
 * and no entry has to anticipate the subpaths a package ships.
 */
function isServerOnlySpecifier(specifier: string, serverOnlyPackages: string[]): boolean {
  if (specifier.startsWith("node:")) return true;
  return serverOnlyPackages.includes(packageNameOf(specifier));
}

/**
 * True when this module actually crosses the server-function boundary: it binds
 * one of the boundary's calls by importing it FROM the boundary module, and it
 * calls that binding.
 *
 * One question about one binding, not two questions about a file. Two separate
 * questions — "is the module imported anywhere" and "does the call name appear"
 * — is a word test with an extra step, and a review proved it: two bare words
 * defeated it in turn. See `boundaryBindingsIn`.
 *
 * `source` is comment-blanked, so neither half can be satisfied by prose.
 */
function crossesServerFnBoundary(
  source: string,
  boundary: { module: string; calls: string[] },
): boolean {
  // Validated as identifiers by `assertGoverningConfig`, which is what makes
  // interpolating a call name into a matcher sound. The MODULE is compared as a
  // plain string rather than matched, so it needs no escaping and no validation
  // beyond being nonempty.
  const bodyOfFile = source.replace(IMPORT_CLAUSE, "");
  return boundaryBindingsIn(source, boundary).some(
    (local) =>
      !rebindsName(bodyOfFile, local) && new RegExp(String.raw`\b${local}\s*\(`).test(bodyOfFile),
  );
}

/**
 * True when `body` declares `local` itself — so a call of that name might be the
 * file's own binding rather than the imported one.
 *
 * This tier has no parser. Bun's transpiler hands back specifiers, not an AST,
 * and TypeScript 7 ships its AST behind an `unstable/` entry point that a copied
 * template must not depend on. So scope is approximated, and the approximation is
 * deliberately one-sided: ANY local declaration or parameter of the name makes
 * the file not-a-boundary, which keeps the trace going. Two reviews shadowed the
 * imported name and beat the version of the day: first a parenthesized parameter
 * (`function settleWith(createServerFn: …)`), then the same shadow spelled with
 * no parenthesis at all (`createServerFn => …`). Each accepted the shadowed call
 * as a boundary and suppressed a reachable `postgres` finding.
 *
 * Being one-sided is what makes it sound without a parser: the cost of a false
 * positive here is a chain that gets traced and possibly reported, which is the
 * over-report this check already names in its header. The cost of a false
 * negative is a server-only package in the client bundle and a green run.
 *
 * NEGATIVE SPACE: passing the binding as an ARGUMENT (`register(createServerFn)`)
 * reads as a parameter position to this and takes the file out of the boundary,
 * for the same one-sided reason.
 */
function rebindsName(body: string, local: string): boolean {
  // A namespace binding is spelled `RS\.createServerFn` here, and a member
  // expression is never a declaration — only the namespace object could be
  // rebound, and it is checked as its own name.
  const [head] = local.split("\\.");
  return BINDING_FORMS.some((form) => new RegExp(form(head)).test(body));
}

/**
 * The spellings that BIND a name, as regex sources over a comment-blanked,
 * import-stripped body.
 *
 * A list rather than one alternation because each entry earns its place
 * separately: every entry here has a fixture that goes red when only that entry
 * is deleted. Two were added after a review beat the previous version — an
 * unparenthesized arrow parameter (`createServerFn => …`) matches no paren and
 * no comma, and a destructured parameter matches neither.
 *
 * NEGATIVE SPACE: a rest binding (`...createServerFn`) is deliberately absent. A
 * rest element is always an array or an object, so the shadow it creates can
 * never be spelled `createServerFn(...)` — the call form this check looks for.
 * An entry for it could not be revert-probed, and an unprobeable entry is the
 * thing this catalog exists to keep out.
 *
 * Every entry is deliberately loose. A false match takes the file out of the
 * boundary and the trace continues — the over-report this check names in its
 * header — while a miss is a server-only package in the client bundle behind a
 * green run.
 */
const BINDING_FORMS: ((name: string) => string)[] = [
  // function f, const f, let f, var f, class f
  (name) => String.raw`\b(?:function|const|let|var|class)\s+${name}\b`,
  // (f), (f: T), (a, f), (f = x) — a parenthesized parameter
  (name) => String.raw`[(,]\s*${name}\s*[:,)=]`,
  // f => … — the arrow parameter with no parentheses at all
  (name) => String.raw`\b${name}\s*=>`,
  // { f }, [ f ] — a destructured binding position, SHORTHAND only. A `:` after
  // the name is deliberately not accepted: in a pattern, `{ f: g }` binds `g` and
  // not `f`, and in an object literal `{ f: "x" }` binds nothing at all. Accepting
  // it made an ordinary literal mentioning the name take a real boundary file out
  // of the boundary — a review reported a legal fixture that way.
  (name) => String.raw`[{[]\s*${name}\s*[},\]]`,
];

/**
 * Every local name in `source` that is bound to one of the boundary's calls by an
 * import FROM the boundary module — under the name the file gave it.
 *
 * The import and the call have to be the same binding, and asking the two
 * questions separately is not the same claim. A review proved that: it replaced
 * the named import with a bare `import "@tanstack/react-start"` and defined an
 * unrelated local `createServerFn`, and the old two-question version accepted it
 * and suppressed a reachable `postgres` finding. A side-effect import binds
 * nothing, so it contributes no name here.
 *
 * A namespace import is read too — `import * as RS` makes the boundary
 * `RS.createServerFn` — because a file that imports the module that way and calls
 * through it has crossed exactly the same boundary.
 *
 * This reads the import CLAUSE only. Whether the name it binds is the one
 * actually called is `rebindsName`'s question, and the two together are what
 * make this a claim about a binding rather than about two words.
 *
 * NEGATIVE SPACE: a binding that arrives through a LOCAL re-export
 * (`export { createServerFn } from "@tanstack/react-start"` in a sibling, then
 * imported from there) is not recognised. The trace continues past that module,
 * so the check can report a chain the framework would have cut — a false blocking
 * error, which is the cost of the narrow reading and the reason to widen this
 * before widening anything else here.
 */
function boundaryBindingsIn(
  source: string,
  boundary: { module: string; calls: string[] },
): string[] {
  const locals: string[] = [];
  for (const match of source.matchAll(IMPORT_CLAUSE)) {
    const clause = match[1] ?? "";
    if (match[2] !== boundary.module) continue;

    const namespace = /\*\s+as\s+([A-Za-z_$][\w$]*)/.exec(clause);
    if (namespace !== null) {
      for (const call of boundary.calls) locals.push(`${namespace[1]}\\.${call}`);
    }

    // Split the braces into entries and read each as `imported as local`, rather
    // than searching the whole clause for the call's name. Searching found the
    // name on EITHER side of an `as`, so `import { unrelatedExport as
    // createServerFn }` read as importing the boundary: a review used exactly
    // that to stop the trace at a boundary the file never crossed, with all 16
    // structural checks green. Which side the name sits on is the whole question.
    for (const entry of (NAMED_IMPORT_LIST.exec(clause)?.[1] ?? "").split(",")) {
      const named = NAMED_IMPORT_ENTRY.exec(entry.trim());
      if (named === null) continue;
      const [, imported = "", local] = named;
      if (boundary.calls.includes(imported)) locals.push(local ?? imported);
    }
  }
  return locals;
}

/** The braces of an import clause: group 1 is the comma-separated entry list. */
const NAMED_IMPORT_LIST = /\{([^}]*)\}/;

/** One entry of that list: group 1 is the EXPORTED name, group 2 the local alias. */
const NAMED_IMPORT_ENTRY = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/;

/**
 * One import declaration: group 1 is the clause, group 2 is the specifier.
 *
 * A side-effect import (`import "x"`) has no `from` and deliberately does not
 * match — it binds no name, so there is nothing for the call test to be about.
 */
const IMPORT_CLAUSE = /import\s+([^;]*?)\s+from\s+["']([^"']+)["']/g;

export const barrelPurityCheck: StructuralCheck = {
  id: "api/barrel-purity",
  scope: "tree",

  run(context) {
    const { config, vocabulary } = context;
    const { serverOnlyPackages, maxTraceDepth, serverFnBoundary } =
      config.checks["api/barrel-purity"];
    const { jsxImportSource } = config;
    const findings: Finding[] = [];

    // Which directories hold barrels, and what a barrel is called, are the
    // tree's vocabulary rather than this check's config: a barrel list beside
    // the rule is the same fact twice, and the stale copy traces nothing while
    // reporting clean.
    for (const barrelDir of subdividedDirs(vocabulary)) {
      // Features re-export server-function references from their controllers, so
      // the short-circuit is what keeps this check usable there. Domains never
      // define server functions, so tracing a domain barrel must not stop at a
      // module that merely mentions the marker.
      const shortCircuitApplies = barrelDir === vocabulary.featuresDir;

      // The CLIENT barrel only. The server barrel is server-only by
      // construction, so a server-only import through it is the file working.
      for (const barrelFilename of SOURCE_EXTENSIONS.map(
        (extension) => `${vocabulary.clientBarrelModule}.${extension}`,
      )) {
        for (const barrel of collectTreeFiles(context, `*/${barrelFilename}`, { under: barrelDir })) {
          const file = toProjectPath(config, barrel);
          // The tree's own server barrel, not the client one with `.server`
          // spliced in. Mangling the string means a tree that renames either
          // barrel gets a message prescribing a file it does not have, which is
          // an ownership message naming a module nobody can create.
          const serverBarrel = `${vocabulary.serverBarrelModule}${extname(barrelFilename)}`;

          const report = (line: number | undefined, message: string) =>
            findings.push({ severity: "error", file, line, message });

          // Per barrel, and it is cycle detection rather than the depth cap that
          // makes the recursion terminate: two modules re-exporting each other
          // otherwise recurse until the cap, which then reports a truncated chain
          // on a barrel that is clean.
          const visited = new Set([barrel]);

          const trace = (
            absolute: string,
            chain: string[],
            depth: number,
            originLine: number | undefined,
          ): void => {
            const raw = readFile(absolute);

            // Blanked, not stripped, so the offset of a specifier still maps to
            // its real line — and so a commented-out import cannot claim the line
            // of the live one below it.
            const source = blankComments(raw);

            if (
              shortCircuitApplies &&
              depth > 0 &&
              crossesServerFnBoundary(source, serverFnBoundary)
            ) {
              return;
            }

            const lineStarts = lineStartOffsets(source);

            for (const specifier of runtimeSpecifiers(absolute, raw, jsxImportSource)) {
              const line =
                depth === 0 ? lineOfSpecifier(source, lineStarts, specifier) : originLine;

              if (isServerOnlySpecifier(specifier, serverOnlyPackages)) {
                report(
                  line,
                  `Transitively pulls in the server-only package "${specifier}".\n` +
                    `Chain: ${[...chain, specifier].join(" → ")}\n` +
                    `Every client component and route may import this barrel, so the whole chain\n` +
                    `lands in the client bundle and the build breaks. Move the server-only export\n` +
                    `to the sibling ${serverBarrel}, or put it behind a server function.\n` +
                    `The package list is \`serverOnlyPackages\` in the project's architecture config.\n` +
                    RESOLUTION_NOTE,
                );
                continue;
              }

              const target = resolveTracedImport(context, absolute, specifier);
              if (target === undefined || visited.has(target)) continue;

              if (depth + 1 > maxTraceDepth) {
                // Reported rather than dropped: a silently truncated chain reads
                // as a clean barrel, which is the same failure this whole tier
                // exists to make impossible.
                report(
                  line,
                  `Trace stopped at the depth limit of ${maxTraceDepth} hops, so what lies below\n` +
                    `"${specifier}" is UNKNOWN — this is not a clean result.\n` +
                    `Chain: ${[...chain, toProjectPath(config, target)].join(" → ")}\n` +
                    `Either shorten the chain between the barrel and its leaves, or raise\n` +
                    `\`maxTraceDepth\` in the project's architecture config and re-run.`,
                );
                continue;
              }

              visited.add(target);
              trace(target, [...chain, toProjectPath(config, target)], depth + 1, line);
            }
          };

          trace(barrel, [file], 0, undefined);
        }
      }
    }

    return findings;
  },
};

/**
 * The line a specifier is written on, or undefined when the literal is absent —
 * the reader returns the COOKED path, so a specifier spelled with a unicode
 * escape matches no text in the file. A finding against the barrel with no line
 * is still actionable; a wrong line on a blocking check is not.
 */
function lineOfSpecifier(
  source: string,
  lineStarts: number[],
  specifier: string,
): number | undefined {
  for (const quote of ['"', "'"]) {
    // indexOf, not a regex — a specifier can hold regex metacharacters.
    const at = source.indexOf(`${quote}${specifier}${quote}`);
    if (at !== -1) return lineNumberAt(lineStarts, at);
  }
  return undefined;
}
