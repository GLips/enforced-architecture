// ─── What a file imports, and what it offers ──────────────────────────
//
// Makes sure of nothing on its own. Two questions about a module's clauses, one
// parser, and this is the tier's ONE answer to each:
//
//   `scanDeclaredImports` — which specifiers does this file NAME. Consumed by
//   `import-graph` (which resolves each one and compares the two ends as paths)
//   and by `api/barrel-purity` (which asks which packages a barrel can reach at
//   runtime).
//
//   `scanDeclaredExports` — which names does this file OFFER, and where each one
//   comes from. Consumed by `naming/barrel-discoverability`, whose subject is
//   whether a public name is greppable; it never resolves a specifier and asks
//   nothing about where one lands.
//
// Do not let a consumer read either question for itself. Two answers to one of
// them disagree about which spellings count, and the disagreement is invisible,
// because the reader that misses a form reports nothing rather than failing.
//
// The two questions overlap on the STATEMENT and not on the subject: `export { a
// } from "./x"` is an occurrence of `./x` to the first and an offer of `a` to the
// second. Both readings come off one export record here, so no consumer can hold
// a third idea of what that line says.
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
// ── Every occurrence, in source order, with a real span (imports) ─────
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
// ── One entry per NAME (exports) ──────────────────────────────────────
//
// Where the two questions part. An import occurrence is one written specifier,
// so `export { a, b } from "./x"` is ONE of those — two edges on one line would
// make every rule reading the graph report that line twice. It is TWO offers,
// because `a` and `b` are two symbols a reader greps for separately, and the
// offer carries the span of its own member so a list running down a screen
// reports each name where it is written.
//
// `typeOnly` is per name for the same reason, and it is not the import side's
// all-or-nothing mark: in `export { type A, b } from "./x"`, `A` is erased and
// `b` is not, and a consumer asking about `A` is asking about `A`.
//
// ── NEGATIVE SPACE ────────────────────────────────────────────────────
//
// WHAT A WILDCARD OFFERS IS NOT HERE. `export * from "./x"` is reported as a
// wildcard and never expanded: the names it forwards are declared in another
// file, and enumerating them means resolving the specifier and reading what is
// there — the next substrate's question, and then a whole chain of them. A
// consumer that needs the expanded surface walks the graph itself. Nothing here
// can tell you whether a wildcard offers one name or four hundred.
//
// CommonJS has no export record and none is reconstructed. `module.exports = …`
// and `exports.a = …` put names on a surface, and neither is read: the import
// side reads `require` because a boundary crossing is its subject, and no check
// in the tier asks what a CommonJS module offers. A project whose public surface
// is spelled that way has no check reading it.
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
// PARSE ERRORS THROW, on both questions. A file whose clauses cannot be read is
// a file no boundary rule and no naming rule governs, and the tier has one job
// that outranks completing the run.
// ──────────────────────────────────────────────────────────────────────

import { parseSync, type ParseResult } from "oxc-parser";
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
 * One name a file offers, or one wildcard it forwards.
 *
 * A union rather than one record of nullable names, because a consumer that has
 * to rebuild "is this a wildcard" out of which fields came back null is a second
 * reading of the export record. `export * from "./x"` offers no name of its own
 * and `export default expr` offers one that HAS no name, and a shape where both
 * are a null cannot tell a reader which it is holding.
 */
export type ScannedExport = {
  /**
   * Byte offset of the ENTRY: the member inside the clause for a named export,
   * the statement for a wildcard. A list running down a screen reports each name
   * where it is written, not where the statement opened.
   */
  offset: number;
  /**
   * True when this name emits no runtime code — `export type { A }` and
   * `export { type A }` alike. Per NAME, so one clause can carry both.
   */
  typeOnly: boolean;
} & (
  | {
      kind: "wildcard";
      /** `ns` in `export * as ns from "./x"`; undefined for the bare `export *`. */
      namespace: string | undefined;
      /**
       * Never undefined: `export *` does not parse without a `from`, so a
       * wildcard always has somewhere to point. Read as the language reads it —
       * a unicode escape arrives decoded, exactly as on the import side.
       */
      specifier: string;
    }
  | {
      kind: "named";
      /** The name the module offers it under — `b` in `export { a as b }`. */
      exportedName: string;
      /**
       * The name it has where it is defined — `a` in `export { a as b }`, and
       * `default` in `export { default as b } from "./x"`.
       */
      localName: string;
      /**
       * Where the name comes from, decoded as above. Undefined when this file
       * declares it: every `export const`, and the second half of an
       * import-then-re-export pair.
       */
      specifier: string | undefined;
    }
  | {
      kind: "default";
      /**
       * The declaration's own name, when it has one: `fn` in
       * `export default function fn() {}`, undefined when it is anonymous.
       *
       * NOTHING READS THIS TODAY. It is here because a default export is a name
       * on the surface, and dropping the form would make this module's
       * one-answer claim false the first time a check wants it. There is no
       * specifier: `export { default as b } from "./x"` is a `named` entry, and
       * `export default` never carries a `from`.
       */
      localName: string | undefined;
    }
);

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
 * The parse both questions read, or the error that says which file refused.
 *
 * `path` decides the grammar by its extension and names the file if the parse
 * fails — a diagnostic against `input.tsx` names a file nobody has.
 */
function parseModule(options: { path: string; source: string }): ParseResult {
  const { path, source } = options;
  const parsed = parseSync(path, source, { lang: grammarFor(path) });

  const fatal = parsed.errors.filter((error) => error.severity === "Error");
  if (fatal[0] !== undefined) throw new Error(`could not read ${path}: ${fatal[0].message}`);

  return parsed;
}

/**
 * Every specifier the file names, in source order. The tier's one extraction,
 * and the only supported way to read a file's imports.
 */
export function scanDeclaredImports(options: { path: string; source: string }): ScannedImport[] {
  const parsed = parseModule(options);

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

/**
 * Every name the file offers, in source order. The tier's one reading of a
 * module's public surface, and the only supported way to ask what a barrel says.
 *
 * The record already carries every field a text pass reconstructs, and carries
 * them for the forms a text pass cannot see: a name written as a string literal
 * (`export { a as "some name" }`), a brace inside one, a specifier spelled with
 * a unicode escape. Anything reading the export clause out of the source text is
 * a second answer to this question, and it is the narrower one.
 */
export function scanDeclaredExports(options: { path: string; source: string }): ScannedExport[] {
  const parsed = parseModule(options);

  const found: ScannedExport[] = [];

  for (const statement of parsed.module.staticExports) {
    for (const entry of statement.entries) {
      const shared = { offset: entry.start, typeOnly: entry.isType };
      const specifier = entry.moduleRequest?.value;
      const exportedName = entry.exportName.name;
      // A re-export's local side is the name in the OTHER module, which the
      // record calls the import name; a name this file declares has no import
      // name and its local side is the local one. Exactly one of the two is set
      // on any entry that has a local side at all.
      const localName = entry.importName.name ?? entry.localName.name;

      // Three arms, and they exhaust the record: every entry either forwards a
      // set of names (`All` is `export * as ns from`, `AllButDefault` the bare
      // `export *`), or is the default export, or carries both a local and an
      // exported name. `module-scanning.test.ts` counts a source holding all of
      // them, because an arm that stopped matching would drop its form in
      // silence.
      //
      // The module request is part of the wildcard test because the grammar
      // makes it part of the form — `export *` does not parse without a `from`,
      // so a wildcard always has somewhere to point.
      const forwardsEverything =
        entry.importName.kind === "All" || entry.importName.kind === "AllButDefault";

      if (forwardsEverything && specifier !== undefined) {
        const namespace = exportedName ?? undefined;
        found.push({ ...shared, kind: "wildcard", namespace, specifier });
      } else if (entry.exportName.kind === "Default") {
        found.push({ ...shared, kind: "default", localName: localName ?? undefined });
      } else if (exportedName !== null && localName !== null) {
        found.push({ ...shared, kind: "named", exportedName, localName, specifier });
      }
    }
  }

  // Not sorted. The record is walked in source order already — statements as
  // they are written, entries within a statement likewise — and the import scan
  // sorts because it MERGES three structures, which this does not. A sort here
  // would be a guard no case can fail, which is the thing this catalog reports
  // people for.
  return found;
}
