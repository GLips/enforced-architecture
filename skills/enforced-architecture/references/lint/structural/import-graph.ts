// ─── graph/import-graph — the resolved import graph ───────────────────
//
// Makes sure: Every rule sees where an import lands, and not how a person
// writes it. The relative path "../../beta/service" and the alias
// "@/features/beta" give the same answer. A person cannot get past a boundary
// rule when they write a crossing as a relative path.
//
// Not a rule. This is the substrate every graph-reading check consumes, and no
// check reads imports itself. Whether an import leaves its boundary depends on
// the depth of the file that holds it, never on the shape of the specifier, so
// each edge is resolved and compared as a path. Do not match a pattern against
// a specifier.
//
// This file holds POLICY and no substrate. Finding the specifiers belongs to
// `module-scanning.ts` and following them to `module-resolution.ts`; what is
// here is the composition — classify both ends, keep the edge, place it on a
// line.
//
// api/barrel-purity is the one rule that reads imports and does not take the
// graph. Resolution discards bare package names, and those names are that
// rule's subject. It takes the same two substrates one layer lower, scanning
// for itself and resolving for itself, rather than a second answer to either.
//
// ──────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { featureLayerRole, SOURCE_FILE_GLOB, type TreeVocabulary } from "../policy/layout.ts";
import {
  collectTreeFiles,
  lineNumberAt,
  lineStartOffsets,
  toProjectPath,
  type TreeContext,
} from "./check-substrate.ts";
import { scanDeclaredImports } from "./module-scanning.ts";

/**
 * Where one end of an edge sits, as far as any rule here asks.
 *
 * A union rather than a record of optional fields, because the mutual exclusions
 * are facts about the tree and belong in the type. A path is in a feature or in
 * a domain and never both; a layer is a position INSIDE a feature, so a domain
 * end and an `infrastructure` end have no layer to read. As a product type every
 * one of those combinations typechecked, and the consumers carried runtime
 * guards recovering the shape the type declined to state.
 *
 * The boundary STRING is deliberately not here. For a feature or a domain it is
 * `<dirName>/<name>` and the consumer that wants it already holds both halves;
 * for anything else no rule asked. A consumer needing more about an end than
 * this says reads `edge.target`, which is the resolved path — see the note on
 * that field.
 *
 * Features are tested before domains, so a tree that gave `featuresDir` and
 * `domainsDir` the same spelling would classify every domain as a feature and
 * take every domain rule quiet. That vocabulary cannot be declared —
 * `assertGoverningVocabulary` refuses a name collision among the top-level
 * positions, for exactly this reason — so the order here is an implementation
 * detail rather than a hole.
 */
export type Classification =
  | {
      kind: "feature";
      feature: string;
      /**
       * First segment inside the feature, when it names a configured layer.
       * Undefined is a real answer rather than a missing one: a file at the
       * feature root sits in no layer, and whether it may sit there at all is
       * `placement/topology`'s question.
       */
      layer: string | undefined;
    }
  | { kind: "domain"; domain: string }
  /**
   * In neither a feature nor a domain. Three unrelated positions collapse here
   * on purpose, because no rule distinguishes them: a file sitting directly in
   * the source root, an undivided top-level directory (`infrastructure`,
   * `shared`, `routes`), and a subdivided directory that is neither the features
   * nor the domains one.
   */
  | { kind: "neither" };

export type ImportEdge = {
  /** Importing file, project-relative. */
  file: string;
  /**
   * The importing file's path FROM THE SOURCE ROOT, the same frame `target`
   * is in. Both ends of an edge have to be in one frame to be compared, and
   * the graph already computes this to classify `from` — consumers that
   * re-derived it from `file` each carried their own root-stripper, and the
   * two disagreed on a path outside the root.
   */
  sourcePath: string;
  /** 1-based, and always known: the scanner reports the span of every specifier it finds. */
  line: number;
  /** As written, for the message only. Never match on this. */
  specifier: string;
  /** Written as a path rather than through the alias. This is where the two tiers divide. */
  relative: boolean;
  /**
   * The RESOLVED path from the source root. Classification alone collapses
   * distinctions a consumer still needs — `layer-occupancy` has to tell
   * `infrastructure/db/schema` from `infrastructure/db/client`, and both
   * classify as `infrastructure`.
   *
   * It names the MODULE, extension and all, whenever a file on disk backs the
   * specifier — `module-resolution.ts` decides that, and `@/features/orders`
   * arrives here as `features/orders/index.ts`. When nothing backs it, this is
   * the position the specifier named and the edge is still here: see that
   * module's note on why resolution may not delete an edge. Compare it the way
   * every consumer already does, on whole segments or with the extension
   * stripped; a consumer testing `target === "features/orders"` is testing a
   * spelling.
   */
  target: string;
  /**
   * True when THIS occurrence emits no runtime code.
   *
   * Per occurrence rather than per specifier. One file may import `./a` for its
   * type on one line and for its value on the next, and a rule that allows the
   * erased coupling and denies the real one has to be able to tell the two lines
   * apart. Nothing about the file's other imports is folded in here.
   */
  typeOnly: boolean;
  from: Classification;
  to: Classification;
};

export function classify(
  vocabulary: TreeVocabulary,
  pathFromSourceRoot: string,
): Classification {
  const { featuresDir, domainsDir } = vocabulary;
  const [top, second, third] = pathFromSourceRoot.split("/");

  // No directory component means a file sitting directly in the source root — an
  // entrypoint, an env module, a generated route tree. They compose the app
  // rather than living in a part of it, so they are in no feature and no domain
  // and `./router` from `client.tsx` is two files at one position rather than a
  // crossing. Reading them one at a time is where that false positive comes from.
  if (top === undefined || second === undefined) return { kind: "neither" };

  // A top-level directory that is not one of the two subdivided ones is one
  // position whole — `infrastructure`, `shared`, `routes`. Nothing inside it
  // ranks or grants.
  if (top === featuresDir) {
    return {
      kind: "feature",
      feature: second,
      layer:
        third !== undefined && featureLayerRole(vocabulary, third) !== undefined ? third : undefined,
    };
  }

  if (top === domainsDir) return { kind: "domain", domain: second };

  return { kind: "neither" };
}

/**
 * Every resolved import edge inside ONE declared tree.
 *
 * Callers should reach this through `TreeContext.importGraph()`, which builds it
 * once per tree and shares it. Calling this directly rescans the tree.
 */
export function buildImportGraph(context: TreeContext): ImportEdge[] {
  const { vocabulary } = context;
  const root = context.sourceRoot;
  const edges: ImportEdge[] = [];

  for (const absolute of collectTreeFiles(context, SOURCE_FILE_GLOB)) {
    const file = toProjectPath(context.config, absolute);
    const raw = readFileSync(absolute, "utf8");
    const lineStarts = lineStartOffsets(raw);
    const sourcePath = relative(root, absolute);
    const from = classify(vocabulary, sourcePath);

    for (const scanned of scanDeclaredImports({ path: file, source: raw })) {
      // `sourcePath` off either arm, resolved or not. Which one it came from is
      // `api/barrel-purity`'s question, because that check has to OPEN the far
      // end; here both ends are compared as positions, and an import naming a
      // position no file backs is still an import into that position.
      const target = context.resolveModule(absolute, scanned.specifier)?.sourcePath;
      if (target === undefined) continue;

      edges.push({
        file,
        sourcePath,
        line: lineNumberAt(lineStarts, scanned.offset),
        specifier: scanned.specifier,
        relative: scanned.specifier.startsWith("."),
        target,
        typeOnly: scanned.typeOnly,
        from,
        to: classify(vocabulary, target),
      });
    }
  }

  return edges;
}
