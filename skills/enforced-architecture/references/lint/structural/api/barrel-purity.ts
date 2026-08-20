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
// The serverFnMarkers test is a string match on the text of the file, so the
// stop below a marker is an assumption. A comment, a string, or an unused import
// with the marker name also stops the trace. This check under-reports, and it
// does not over-report.
//
// ──────────────────────────────────────────────────────────────────────

import { statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ArchitectureConfig } from "../config.ts";
import { scanDeclaredImports } from "../import-graph.ts";
import {
  blankComments,
  collectFiles,
  lineNumberAt,
  lineStartOffsets,
  readFile,
  sourceRoot,
  toProjectPath,
  type Finding,
  type StructuralCheck,
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
 */
const RESOLUTION_SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];

/**
 * Where an internal specifier lands, or undefined when it is not internal.
 *
 * Aliased specifiers are followed as well as relative ones. They are the same
 * edge written differently, and following only relative ones ends the trace at
 * the first `@/shared/…` hop and reports the barrel clean.
 */
function resolveTracedImport(
  config: ArchitectureConfig,
  fromFile: string,
  specifier: string,
): string | undefined {
  const { aliasPrefix } = config.source;
  const base = specifier.startsWith(aliasPrefix)
    ? resolve(sourceRoot(config), specifier.slice(aliasPrefix.length))
    : specifier.startsWith(".")
      ? resolve(dirname(fromFile), specifier)
      : undefined;

  if (base === undefined) return undefined;

  for (const suffix of RESOLUTION_SUFFIXES) {
    const candidate = `${base}${suffix}`;
    // `isFile` matters for the empty suffix: a specifier naming a directory
    // exists on disk and is not a module.
    if (statSync(candidate, { throwIfNoEntry: false })?.isFile() === true) return candidate;
  }
  return undefined;
}

const RESOLUTION_NOTE =
  `Resolution here tries the exact path, then .ts, .tsx, /index.ts, /index.tsx. It\n` +
  `does not handle .mts/.cts, and it does not substitute extensions the way\n` +
  `TypeScript does (./target.js → target.ts), so a hop spelled either way ends the\n` +
  `trace without a word.`;

export const barrelPurityCheck: StructuralCheck = {
  id: "api/barrel-purity",

  run({ config }) {
    const {
      barrelDirs,
      barrelFilenames,
      serverOnlyPatterns,
      maxTraceDepth,
      serverFnMarkers,
      serverFnBoundaryDirs,
    } = config.checks["api/barrel-purity"];
    const { jsxImportSource } = config.source;
    const findings: Finding[] = [];

    for (const barrelDir of barrelDirs) {
      // Features re-export server-function references from their controllers, so
      // the short-circuit is what keeps this check usable there. Domains never
      // define server functions, so tracing a domain barrel must not stop at a
      // module that merely mentions the marker.
      const shortCircuitApplies = serverFnBoundaryDirs.includes(barrelDir);

      for (const barrelFilename of barrelFilenames) {
        for (const barrel of collectFiles(config, barrelDir, `*/${barrelFilename}`, {
          fromSourceRoot: true,
        })) {
          const file = toProjectPath(config, barrel);
          const serverBarrel = barrelFilename.replace(/\.tsx?$/, (ext) => `.server${ext}`);

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

            if (
              shortCircuitApplies &&
              depth > 0 &&
              serverFnMarkers.some((marker) => raw.includes(marker))
            ) {
              return;
            }

            // Blanked, not stripped, so the offset of a specifier still maps to
            // its real line — and so a commented-out import cannot claim the line
            // of the live one below it.
            const source = blankComments(raw);
            const lineStarts = lineStartOffsets(source);

            for (const specifier of runtimeSpecifiers(absolute, raw, jsxImportSource)) {
              const line =
                depth === 0 ? lineOfSpecifier(source, lineStarts, specifier) : originLine;

              const serverOnly = serverOnlyPatterns.find((pattern) => pattern.test(specifier));
              if (serverOnly !== undefined) {
                report(
                  line,
                  `Transitively pulls in the server-only package "${specifier}".\n` +
                    `Chain: ${[...chain, specifier].join(" → ")}\n` +
                    `Every client component and route may import this barrel, so the whole chain\n` +
                    `lands in the client bundle and the build breaks. Move the server-only export\n` +
                    `to the sibling ${serverBarrel}, or put it behind a server function.\n` +
                    `The package list is \`serverOnlyPatterns\` in the project's architecture config.\n` +
                    RESOLUTION_NOTE,
                );
                continue;
              }

              const target = resolveTracedImport(config, absolute, specifier);
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
