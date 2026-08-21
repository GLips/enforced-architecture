// ─── The scanner's own cases ──────────────────────────────────────────
//
// `module-scanning.ts` makes no finding, so the fixture tree can only reach it
// through a check's VERDICT — and most of what this module promises does not
// change one. A line hard-coded to 1, an order that is not source order, a
// specifier form dropped from a file that has three others: every one of those
// leaves the whole structural suite green, because a verdict says which file is
// wrong and never where or how many times.
//
// So the properties here are asserted against the scanner directly. What stays
// in the tree is anything a check ANSWERS differently — a `require.resolve`
// crossing that must fire, a type-only re-export that must stay quiet — because
// there the verdict is the claim and asserting the mark instead would prove the
// scanner agrees with itself.
//
// This ships beside the module for the reason `policy/import-policy.test.ts`
// does: a project copying `structural/` gets the proof with the code. A spec
// that lives in the catalog's harness is a spec no adopter ever runs, and the
// module they copied is then unproved in the only repo it will run in.
//
// It imports `node:test`, which the neutrality contract in `overview.md` forbids
// the modules beside it: that contract governs what SHIPS into both runtimes,
// and a spec ships into neither.
//
// ──────────────────────────────────────────────────────────────────────

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scanDeclaredImports, type ScannedImport } from "./module-scanning.ts";

// node:test's `describe` and `it` hand back the suite's promise, and the runner
// owns and awaits the suite it created. Discarding the handle is correct rather
// than merely convenient — a project linting this file with
// `typescript/no-floating-promises` is right to reject the bare call.
function describeSuite(name: string, body: () => void): void {
  void describe(name, body);
}
function testCase(name: string, body: () => void): void {
  void it(name, body);
}

/** The scan of one source, named the way a real file would be. */
function scan(source: string, path = "probe.ts"): ScannedImport[] {
  return scanDeclaredImports({ path, source });
}

const specifiersOf = (scanned: ScannedImport[]): string[] =>
  scanned.map((entry) => entry.specifier);

/** Which line each occurrence's offset lands on — the inverse of the lookup. */
const linesOf = (source: string, scanned: ScannedImport[]): number[] =>
  scanned.map((entry) => source.slice(0, entry.offset).split("\n").length);

const marksOf = (scanned: ScannedImport[]): boolean[] =>
  scanned.map((entry) => entry.typeOnly);

describeSuite("every occurrence carries the parser's span, in source order", () => {
  // Four readers, four lines: the static-import record, the AST's require arm,
  // the export record, and the AST's type-position arm. The leading comment is
  // load-bearing — with a static import at offset 0, an offset hard-coded to
  // zero still lands on line 1 and this passes.
  const FOUR_READERS = [
    `// four readers, four lines`,
    `import { a } from "./first.ts";`,
    `const b = require("./second.ts");`,
    `export { c } from "./third.ts";`,
    `type D = import("./fourth.ts").D;`,
  ].join("\n");

  testCase("the line comes off the span, not off a text search", () => {
    assert.deepEqual(linesOf(FOUR_READERS, scan(FOUR_READERS)), [2, 3, 4, 5]);
  });

  testCase("three structures are read and one order comes out", () => {
    // Imports, re-exports and the AST forms are collected from three separate
    // structures, so nothing about the code makes source order fall out for
    // free — and the harness compares findings as a multiset, which cannot see
    // order at all. A reader going down a report is who this is for.
    assert.deepEqual(specifiersOf(scan(FOUR_READERS)), [
      "./first.ts",
      "./second.ts",
      "./third.ts",
      "./fourth.ts",
    ]);
  });

  testCase("one specifier imported twice is two occurrences", () => {
    const source = [`import { a } from "./a.ts";`, `import { b } from "./a.ts";`].join("\n");
    assert.deepEqual(specifiersOf(scan(source)), ["./a.ts", "./a.ts"]);
    assert.deepEqual(linesOf(source, scan(source)), [1, 2]);
  });

  testCase("the specifier is the module's NAME, not its spelling", () => {
    // A unicode escape has a cooked value matching no literal in the source, so
    // a resolver handed the spelling finds nothing and reports the file clean.
    assert.deepEqual(specifiersOf(scan(`import { a } from "./bet\\u0061.ts";`)), ["./beta.ts"]);
  });
});

describeSuite("a file whose imports cannot be read is not a file that reports clean", () => {
  testCase("a parse error throws, and names the file the caller gave", () => {
    // No fixture can state this: an unparseable file in the tree takes the whole
    // run down, which is the correct behaviour and a terrible fixture. The
    // PATH is asserted because a diagnostic against a name nobody has —
    // `input.tsx`, the parser's default — sends the reader looking for a file
    // that is not in their repo.
    assert.throws(
      () => scan(`import { from "./unclosed.ts";`, "broken.ts"),
      /could not read broken\.ts/,
    );
  });
});

describeSuite("the forms the module record does not carry", () => {
  testCase("`import x = require(…)` is an import, and the oxlint tier agrees", () => {
    // TypeScript's own CommonJS binding. It is on no module record and produces
    // no CallExpression, so it reaches neither of the arms that read the other
    // require spellings — and the oxlint tier visits it by name, which is what
    // makes a miss here a DISAGREEMENT between the two tiers rather than a gap
    // in both.
    const scanned = scan(`import thing = require("./thing.ts");`);
    assert.deepEqual(specifiersOf(scanned), ["./thing.ts"]);
    assert.deepEqual(marksOf(scanned), [false]);
  });

  testCase("its type-only spelling is marked erased", () => {
    assert.deepEqual(marksOf(scan(`import type thing = require("./thing.ts");`)), [true]);
  });

  testCase("the namespace spelling names no module and is not one", () => {
    assert.deepEqual(scan(`namespace ns { export const x = 1; }\nimport thing = ns.x;`), []);
  });

  testCase("`export {} from` names a module that is still evaluated", () => {
    // An empty clause has no name to make an entry out of, and the parser emits
    // no export statement for it either — so this whole re-export exists only in
    // the AST. It is a real runtime edge: the module is fetched and run for its
    // side effects, exactly as `import "./x"` is.
    const scanned = scan(`export {} from "./x.ts";`);
    assert.deepEqual(specifiersOf(scanned), ["./x.ts"]);
    assert.deepEqual(marksOf(scanned), [false]);
  });

  testCase("its type-only spelling is erased and still names the module", () => {
    assert.deepEqual(specifiersOf(scan(`export type {} from "./x.ts";`)), ["./x.ts"]);
    assert.deepEqual(marksOf(scan(`export type {} from "./x.ts";`)), [true]);
  });

  testCase("a re-export WITH names is read once, from the record alone", () => {
    // The load-bearing half of the empty-clause arm. Matching the declaration
    // unconditionally reads every named re-export twice — once per structure —
    // and every rule over the graph then reports that line twice.
    assert.deepEqual(specifiersOf(scan(`export { a } from "./x.ts";`)), ["./x.ts"]);
    assert.deepEqual(specifiersOf(scan(`export * from "./x.ts";`)), ["./x.ts"]);
  });
});

describeSuite("typeOnly is a fact about one occurrence", () => {
  testCase("one module, two lines, two answers", () => {
    // The distinction the two consumers read in opposite directions, and the one
    // a scan keyed by specifier STRING cannot express: it has to collapse these
    // two lines into a single coarser verdict.
    const source = [`import type { A } from "./a.ts";`, `import { b } from "./a.ts";`].join("\n");
    assert.deepEqual(marksOf(scan(source)), [true, false]);
  });

  testCase("a side-effect import is the least erased import there is", () => {
    // It binds no name, so "every name on this statement is a type" is VACUOUSLY
    // true of it — and reading that as erased drops the one import form that
    // exists purely to be emitted.
    assert.deepEqual(marksOf(scan(`import "./x.ts";`)), [false]);
  });

  testCase("a re-export is erased only if EVERY name on it is", () => {
    // One occurrence, not one per name: `export { type A, b } from "./x"` is two
    // entries at one offset, and ungrouped it is two edges on one written line.
    // The mark has to come from the whole statement — taken from either end it
    // is right about one of these two cases and wrong about the other.
    assert.deepEqual(marksOf(scan(`export { type A, b } from "./x.ts";`)), [false]);
    assert.deepEqual(marksOf(scan(`export { b, type A } from "./x.ts";`)), [false]);
    assert.deepEqual(marksOf(scan(`export type { A, B } from "./x.ts";`)), [true]);
    assert.deepEqual(marksOf(scan(`export { type A, type B } from "./x.ts";`)), [true]);
  });

  testCase("an import in a type position is erased and a dynamic one is not", () => {
    assert.deepEqual(marksOf(scan(`type C = import("./c.ts").C;`)), [true]);
    assert.deepEqual(marksOf(scan(`type D = typeof import("./d.ts");`)), [true]);
    assert.deepEqual(marksOf(scan(`export const c = () => import("./c.ts");`)), [false]);
  });

  testCase("both require spellings are runtime imports", () => {
    assert.deepEqual(marksOf(scan(`const a = require("./a.ts");`)), [false]);
    assert.deepEqual(specifiersOf(scan(`const a = require.resolve("./a.ts");`)), ["./a.ts"]);
    assert.deepEqual(marksOf(scan(`const a = require.resolve("./a.ts");`)), [false]);
  });
});

describeSuite("the negative space, as a case rather than a paragraph", () => {
  testCase("a specifier built at runtime is not reported, and nothing else sees it either", () => {
    // The tier's one blind spot, stated here so it is a decision rather than an
    // omission somebody later reads as coverage. NO check in the catalog reports
    // this file: not this scan, not the graph over it, not a check counting how
    // many a module builds.
    assert.deepEqual(scan("export const load = (name: string) => import(`./${name}.ts`);"), []);
  });

  testCase("a template with nothing interpolated is a static specifier", () => {
    // The other side of the same line. A formatter or a codemod writes this as
    // readily as a person does, and every bundler treats it as naming one
    // module — reading only `Literal` drops a real edge with no error.
    assert.deepEqual(specifiersOf(scan("export const load = () => import(`./a.ts`);")), ["./a.ts"]);
  });
});
