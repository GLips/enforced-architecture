// ─── What a file imports ──────────────────────────────────────────────
//
// Makes sure of nothing on its own. This is the tier's ONE answer to "which
// specifiers does this file name", consumed by `import-graph` (which resolves
// each one and compares the two ends as paths) and by `api/barrel-purity` (which
// asks which packages a barrel can reach at runtime). Do not let either of them
// read imports for itself: two answers to this question disagree about which
// spellings count, and the disagreement is invisible, because the reader that
// misses a form reports nothing rather than failing.
//
// ONE reader in the tier is outside that claim, and it is stated here rather
// than left to be discovered: `naming/barrel-discoverability` matches
// `export * from` and `export { … } from` with its own regexes and quotes the
// captured specifier back in its message. Its SUBJECT is the exported NAMES —
// which symbols a barrel puts on its public surface, and whether each is
// greppable — so it never resolves the specifier, never asks where it lands, and
// makes no claim about which spellings of an import exist. It reads a statement
// this module also reads, for a different question. A reader that wanted the set
// of modules a file names, or where any of them lands, would be a second answer
// to THIS question and belongs here.
//
// This is the third substrate in the tier, beside `module-resolution.ts` (where
// a specifier LANDS) and `type-checker.ts` (what a declaration MEANS). This one
// is upstream of both: nothing can be resolved before it is found.
//
// The parse is `oxc-parser`'s — the parser under the oxlint this catalog already
// ships, and the same project as the `oxc-resolver` beside it. What it buys over
// a transpiler's import scan is that it does not ERASE and does not INJECT: a
// transpiler is asked what the emitted module needs, and the answer is missing
// every type-only import and carrying JSX-runtime imports the file never wrote.
// Recovering the first by rewriting the source and subtracting the second by
// counting `require(` literals is what this module replaced, and both were
// approximations that lost real forms — see TYPE-ONLY IMPORTS below.
//
// ── Every occurrence, in source order, with a real span ───────────────
//
// One entry per OCCURRENCE, not per specifier: a file importing `./a` twice gets
// two entries, because `boundary/import-policy` reports each crossing where it
// is written. `offset` is the span of the module-request literal, which the
// parser knows exactly. Nothing here searches the text for a quoted specifier —
// a specifier written with a unicode escape has a cooked value matching no
// literal in the source, and prose quoting the same path can sit above the real
// import and claim its line.
//
// ── TYPE-ONLY IMPORTS ─────────────────────────────────────────────────
//
// `typeOnly` is per occurrence and it is the whole reason this is a parser. An
// import is type-only when it emits no runtime code, which the two consumers
// want in OPPOSITE directions: the graph keeps those edges, because a type
// import still couples two boundaries, and `api/barrel-purity` drops them,
// because a type import cannot put a server-only package in a client bundle.
//
// A scanner that erases them can only serve the second, and the first then has
// to rebuild what was thrown away. These are the five forms the rewrite-and-
// rescan pass could not rebuild, each one a valid import that reached NO check:
//
//   import /* why */ type { A } from "./a";   // a comment between the keywords
//   export type /* why */ { B } from "./b";
//   import { type A /* } */ } from "./a";     // a brace in a comment ends the clause
//   type C = import("./c").C;                 // an import in a type position
//   type D = typeof import("./d");
//
// The last two are not a rewriting problem at all — no spelling of `import type`
// appears in them — and no text pass was ever going to reach them.
//
// ── NEGATIVE SPACE ────────────────────────────────────────────────────
//
// A specifier that is not a static string is not reported and cannot be:
// `import(`./${name}`)` names a module only at runtime. This is the one import
// form the tier is blind to, and it is blind to it by construction rather than
// by omission.
//
// NOTHING ELSE IN THE CATALOG COVERS IT. No check reads a computed specifier, no
// check counts how many a module has, and no check reports a module for building
// one — so a boundary crossed through a computed specifier is crossed with every
// rule here silent, and the run is green. Do not read this paragraph as a
// hand-off: there is no second check downstream that catches what this cannot
// see. A project that routes real crossings through computed specifiers is a
// project this tier does not govern, and the only fix is to write the specifier
// statically.
//
// `require()`, `require.resolve()` and `import x = require()` are reported,
// because a project that still has CommonJS in it crosses boundaries with them,
// and an unreported crossing is a rule that silently does not apply to those
// files. `import.meta` is not an import and is not reported.
//
// PARSE ERRORS THROW. A file whose imports cannot be read is a file no boundary
// rule governs, and the tier has one job that outranks completing the run.
// ──────────────────────────────────────────────────────────────────────

import { parseSync } from "oxc-parser";
import { JSX_SOURCE_EXTENSIONS, TYPESCRIPT_SOURCE_EXTENSIONS } from "../policy/layout.ts";

/** One occurrence of one specifier in one file. */
export type ScannedImport = {
  /**
   * The specifier as the language reads it, not as the bytes spell it: a
   * unicode escape arrives decoded. This is what `module-resolution.ts` must be
   * handed, and it is why nothing may look the specifier back up in the source.
   */
  specifier: string;
  /** Byte offset of the module-request literal, for the line lookup. */
  offset: number;
  /**
   * True when this occurrence emits no runtime code. Per occurrence: one file
   * may import `./a` for its type on one line and for its value on the next, and
   * those two lines are different facts about the same specifier.
   */
  typeOnly: boolean;
};

/**
 * Which grammar the parser reads this file with.
 *
 * Derived from the two extension lists the walkers already use rather than
 * spelled as a table, for the reason `JSX_SOURCE_EXTENSIONS` is derived: a
 * hand-written map is how an extension the tree collects becomes one the scanner
 * mis-lexes, and a mis-lexed file loses its imports quietly. An extension added
 * to `SOURCE_EXTENSIONS` lands in the right grammar here without being mentioned
 * here.
 */
function grammarFor(path: string): "ts" | "tsx" | "js" | "jsx" {
  const extension = path.slice(path.lastIndexOf(".") + 1);
  const jsx = JSX_SOURCE_EXTENSIONS.includes(extension);
  if (TYPESCRIPT_SOURCE_EXTENSIONS.includes(extension)) return jsx ? "tsx" : "ts";
  return jsx ? "jsx" : "js";
}

type AstNode = Record<string, unknown>;

/**
 * The specifier a node names, when it names one statically.
 *
 * Both spellings a project actually writes: a string literal, and a template
 * with nothing interpolated into it. `` import(`./rows.ts`) `` is a formatter's
 * or a codemod's output as often as a person's, and reading only `Literal` drops
 * that whole edge with no error — which is the shape of every bug this module
 * exists to stop. A template WITH an expression in it is the runtime-only form
 * in the negative space above, and returns undefined here.
 *
 * Reads the parser's cooked value, never the source text: a specifier written
 * `"./beta-thing.ts"` is an import of `./beta-thing.ts`, and the resolver
 * has to be handed the module's name rather than its spelling.
 */
function staticSpecifierOf(node: unknown): { specifier: string; offset: number } | undefined {
  if (node === null || typeof node !== "object") return undefined;
  const record = node as AstNode;
  const offset = record["start"];
  if (typeof offset !== "number") return undefined;

  if (record["type"] === "Literal") {
    const value = record["value"];
    return typeof value === "string" ? { specifier: value, offset } : undefined;
  }
  if (record["type"] === "TemplateLiteral") {
    const expressions = record["expressions"];
    const quasis = record["quasis"] as Array<AstNode> | undefined;
    if (!Array.isArray(expressions) || expressions.length > 0) return undefined;
    const cooked = (quasis?.[0]?.["value"] as { cooked?: unknown } | undefined)?.cooked;
    return typeof cooked === "string" ? { specifier: cooked, offset } : undefined;
  }
  return undefined;
}

/**
 * The import forms `EcmaScriptModule` does not carry: `import("…")`,
 * `require("…")`, `require.resolve("…")`, `import("…")` in a TYPE position,
 * `import x = require("…")`, and `export {} from "…"`.
 *
 * The module record describes ES imports and exports. Two of these are
 * CommonJS, one is erased before any module record exists, and dynamic import is
 * on the record but only as a SPAN of source text, which is the raw spelling
 * rather than the module's name.
 *
 * The last two are on neither side of the record. `import x = require("…")` is
 * TypeScript's own CommonJS binding: it is not an ES import, and its argument is
 * a `TSExternalModuleReference` rather than a call, so no `CallExpression` arm
 * reaches it either — the oxlint tier visits the declaration by name for the
 * same reason. An export clause with NO NAMES produces no `staticExports`
 * statement at all, and the module it names is still fetched and evaluated for
 * its side effects, exactly as `import "./x"` is.
 *
 * A `require` shadowed by a local binding is reported anyway. That is the loud
 * direction and it is deliberate: the alternative is scope analysis to decide an
 * edge is NOT there, and being wrong in that direction hides a crossing.
 */
function walkForUnrecordedImports(node: unknown, found: ScannedImport[]): void {
  if (node === null || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const child of node) walkForUnrecordedImports(child, found);
    return;
  }

  const record = node as AstNode;
  const type = record["type"];
  if (type === "TSImportType" || type === "ImportExpression") {
    const named = staticSpecifierOf(record["source"]);
    if (named !== undefined) found.push({ ...named, typeOnly: type === "TSImportType" });
  }
  if (type === "CallExpression" && isRequireCallee(record["callee"])) {
    const named = staticSpecifierOf((record["arguments"] as Array<unknown> | undefined)?.[0]);
    if (named !== undefined) found.push({ ...named, typeOnly: false });
  }
  if (type === "TSImportEqualsDeclaration") {
    // `import x = someNamespace.Thing` names no module. Only the external form
    // carries a specifier, and reading the reference's type is what tells them
    // apart.
    const reference = record["moduleReference"] as AstNode | undefined;
    if (reference?.["type"] === "TSExternalModuleReference") {
      const named = staticSpecifierOf(reference["expression"]);
      if (named !== undefined) {
        found.push({ ...named, typeOnly: record["importKind"] === "type" });
      }
    }
  }
  // ONLY when the clause is empty. Every other export with a `from` is on the
  // module record and is read there — matching the declaration unconditionally
  // would report `export { a } from "./x"` twice, once per structure, and every
  // rule reading the graph would report that line twice.
  if (
    type === "ExportNamedDeclaration" &&
    (record["specifiers"] as Array<unknown> | undefined)?.length === 0
  ) {
    const named = staticSpecifierOf(record["source"]);
    if (named !== undefined) {
      found.push({ ...named, typeOnly: record["exportKind"] === "type" });
    }
  }

  // Every key, including `type` itself: it holds a string, which the guard at
  // the top drops in one comparison. Skipping it by name would be an assumption
  // about the AST's shape held in one place and checked in none.
  for (const key of Object.keys(record)) walkForUnrecordedImports(record[key], found);
}

/** `require` or `require.resolve`, and no other callee. */
function isRequireCallee(callee: unknown): boolean {
  if (callee === null || typeof callee !== "object") return false;
  const node = callee as AstNode;
  if (node["type"] === "Identifier") return node["name"] === "require";
  const object = node["object"] as AstNode | undefined;
  const property = node["property"] as AstNode | undefined;
  return object?.["name"] === "require" && property?.["name"] === "resolve";
}

/**
 * Every specifier the file names, in source order. The tier's one extraction,
 * and the only supported way to read a file's imports.
 *
 * `path` decides the grammar by its extension and names the file if the parse
 * fails — a diagnostic against `input.tsx` names a file nobody has.
 */
export function scanDeclaredImports(options: { path: string; source: string }): ScannedImport[] {
  const { path, source } = options;
  const parsed = parseSync(path, source, { lang: grammarFor(path) });

  const fatal = parsed.errors.filter((error) => error.severity === "Error");
  if (fatal[0] !== undefined) throw new Error(`could not read ${path}: ${fatal[0].message}`);

  const found: ScannedImport[] = [];

  for (const statement of parsed.module.staticImports) {
    // A side-effect import (`import "./x"`) has no entries and is never
    // type-only: it exists precisely to be emitted. `every` over an empty list
    // says the opposite, so the emptiness is tested rather than folded in.
    const typeOnly =
      statement.entries.length > 0 && statement.entries.every((entry) => entry.isType);
    found.push({
      specifier: statement.moduleRequest.value,
      offset: statement.moduleRequest.start,
      typeOnly,
    });
  }

  // Re-exports are imports: `export { x } from "./a"` names `./a` and couples
  // the two boundaries exactly as an import statement does. They live on the
  // EXPORT record because that is where the grammar puts them, which is the one
  // reason this loop is separate.
  //
  // NOT EVERY RE-EXPORT IS HERE. `export {} from "./a"` has no name to make an
  // entry out of, and the parser emits no statement for it either — so it is
  // read from the AST by `walkForUnrecordedImports`, with the rest of what the
  // module record does not carry.
  //
  // GROUPED BY THE MODULE REQUEST, because the export record has one entry per
  // NAME and an occurrence here is one written specifier. `export { type A, b }
  // from "./x"` is two entries at one offset: ungrouped it is two edges on one
  // line, so every rule reading the graph reports that line twice. The mark is
  // the same rule the import record follows — erased only if every name on the
  // statement is.
  const byModuleRequest = new Map<number, { specifier: string; typeOnly: boolean }>();
  for (const statement of parsed.module.staticExports) {
    for (const entry of statement.entries) {
      if (entry.moduleRequest === null) continue;
      const seen = byModuleRequest.get(entry.moduleRequest.start);
      byModuleRequest.set(entry.moduleRequest.start, {
        specifier: entry.moduleRequest.value,
        typeOnly: (seen?.typeOnly ?? true) && entry.isType,
      });
    }
  }
  for (const [offset, entry] of byModuleRequest) found.push({ ...entry, offset });

  walkForUnrecordedImports(parsed.program, found);

  return found.sort((left, right) => left.offset - right.offset);
}
