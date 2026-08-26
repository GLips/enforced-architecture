// ─── The theme reader's own cases ─────────────────────────────────────
//
// `theme-scale.ts` makes no finding, and the fixture tree cannot reach it at
// all: the tree's theme module is a plain object the fixture config imports, so
// every property this module promises — the call-wrapped shape, the quoted key,
// the refusal to hand back a short scale — is invisible to a verdict. A reader
// that lost half a scale would leave the whole structural suite green, because
// `style/token-equality` reports which file is wrong and never which tokens it
// was comparing against.
//
// So the properties are asserted against the reader directly, and the refusals
// hardest. A reader that returns `{}` where it should throw is the exact failure
// this module exists to close, and it is the one a passing suite hides best.
//
// This ships beside the module for the reason `import-scanning.test.ts` does: a
// project copying `structural/` gets the proof with the code.
// ──────────────────────────────────────────────────────────────────────

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";
import { readThemeScaleFromSource } from "./theme-scale.ts";

// node:test's `describe` and `it` hand back the suite's promise, and the runner
// owns and awaits the suite it created. See `import-scanning.test.ts`.
function describeSuite(name: string, body: () => void): void {
  void describe(name, body);
}
function testCase(name: string, body: () => void): void {
  void it(name, body);
}

const workspace = mkdtempSync(join(tmpdir(), "theme-scale-"));
after(() => rmSync(workspace, { recursive: true, force: true }));

let written = 0;

/** One theme module on disk, since reading the file is half of what this does. */
function readScale(source: string, exportName = "spacing"): Record<string, string | number> {
  const path = join(workspace, `theme-${(written += 1)}.stylex.ts`);
  writeFileSync(path, source, "utf8");
  return readThemeScaleFromSource({ path, exportName });
}

describeSuite("the literals a human wrote, whatever wraps them", () => {
  testCase("a plain object of constants", () => {
    assert.deepEqual(readScale(`export const spacing = { sm: "0.5rem", md: "1rem" };`), {
      sm: "0.5rem",
      md: "1rem",
    });
  });

  testCase("the StyleX shape, which has no runtime to import", () => {
    assert.deepEqual(
      readScale(
        `import * as stylex from "@stylexjs/stylex";\n` +
          `export const spacing = stylex.defineVars({ sm: "0.5rem", md: "1rem" });`,
      ),
      { sm: "0.5rem", md: "1rem" },
    );
  });

  testCase("px numbers rather than CSS lengths", () => {
    assert.deepEqual(readScale(`export const spacing = defineTokens({ sm: 8, md: 16 });`), {
      sm: 8,
      md: 16,
    });
  });

  testCase("`as const`, which is how a token scale is written in TypeScript at all", () => {
    // Not one spelling among several. `as const` is what makes the token NAMES
    // literal types, so `spacing.m` narrows and a typo in a style prop is a
    // compile error — a reader that stops at TSAsExpression refuses the scale
    // every maturing design system converges on.
    assert.deepEqual(readScale(`export const spacing = { sm: "0.5rem", md: "1rem" } as const;`), {
      sm: "0.5rem",
      md: "1rem",
    });
  });

  testCase("`satisfies`, which types the scale without widening its values", () => {
    assert.deepEqual(
      readScale(`export const spacing = { md: "1rem" } satisfies Record<string, string>;`),
      { md: "1rem" },
    );
  });

  testCase("both wrappers at once, around a call that has no runtime", () => {
    assert.deepEqual(
      readScale(`export const spacing = defineTokens({ md: 16 } as const) as const;`),
      { md: 16 },
    );
  });

  testCase("a SECOND call is not read through, because a call can transform", () => {
    // The type wrappers unwrap however deep they stack; calls do not, and the
    // asymmetry is the point. `as const` erases and cannot change a literal, so
    // reading through it reports what the module writes. A call is a transform:
    // read through `pickHalf` and the scale reported is not the scale in the
    // file, and it would be wrong silently. Refusing sends the adopter to a
    // named export of the object instead.
    assert.throws(
      () => readScale(`export const spacing = defineVars(pickHalf({ sm: 4, md: 8 }));`),
      /no top-level `export const spacing` with an object literal/,
    );
  });

  testCase("one module holds every scale, and each export is asked for by name", () => {
    const source =
      `export const spacing = { md: "1rem" };\nexport const radius = { md: "6px" };`;
    assert.deepEqual(readScale(source, "radius"), { md: "6px" });
  });
});

describeSuite("the spellings a reader written for the obvious case loses", () => {
  testCase("a quoted key, which is how every size scale spells its large end", () => {
    // `2xl` is not an identifier, so a reader taking `key.name` alone drops it —
    // and drops it silently, leaving the scale one token short.
    assert.deepEqual(readScale(`export const spacing = { md: "1rem", "2xl": "3rem" };`), {
      md: "1rem",
      "2xl": "3rem",
    });
  });

  testCase("a type annotation between the name and the initializer", () => {
    assert.deepEqual(
      readScale(`export const spacing: Record<string, string> = { md: "1rem" };`),
      { md: "1rem" },
    );
  });

  testCase("the scale is not the first declarator, nor the first export", () => {
    assert.deepEqual(
      readScale(`export const unrelated = 1;\nexport const a = "x", spacing = { md: "1rem" };`),
      { md: "1rem" },
    );
  });
});

describeSuite("every miss is loud, because a short scale is a silent check", () => {
  testCase("a renamed or misspelled export names the shape it wanted", () => {
    assert.throws(() => readScale(`export const spacings = { md: "1rem" };`), {
      message: /no top-level `export const spacing` with an object literal/,
    });
  });

  testCase("a scale that is re-exported rather than declared is not read", () => {
    // `export { spacing } from "./tokens.ts"` names no object here. Following it
    // would make this a resolver, and a reader that guessed would hand back the
    // scale of whichever module it guessed at.
    assert.throws(() => readScale(`export { spacing } from "./tokens.ts";`), {
      message: /no top-level `export const spacing`/,
    });
  });

  testCase("a call whose object is not its only argument is refused, not guessed at", () => {
    assert.throws(
      () => readScale(`export const spacing = createGlobalTheme(":root", { md: "1rem" });`),
      { message: /no top-level `export const spacing` with an object literal/ },
    );
  });

  testCase("ONE token spelled as an expression takes the whole read down", () => {
    // The case that decides whether this module is worth having. Returning
    // `{ sm, lg }` here is a scale that reports on two tokens and stays quiet on
    // every raw `16` — a green run, one token short, with nothing to notice.
    assert.throws(
      () =>
        readScale(
          `import { base } from "./base.ts";\n` +
            `export const spacing = { sm: "0.5rem", md: base.md, lg: "1.5rem" };`,
        ),
      { message: /with no literal length: md\b/ },
    );
  });

  testCase("a StyleX responsive token has no single length, and says so by name", () => {
    assert.throws(
      () =>
        readScale(
          `export const spacing = stylex.defineVars({\n` +
            `  md: { default: "1rem", "@media (min-width: 40em)": "1.5rem" },\n` +
            `});`,
        ),
      { message: /with no literal length: md\b/ },
    );
  });

  testCase("a spread carries tokens this cannot count", () => {
    assert.throws(() => readScale(`export const spacing = { ...base, md: "1rem" };`), {
      message: /a spread element/,
    });
  });

  testCase("an empty object is the check switched off, and is refused as one", () => {
    assert.throws(() => readScale(`export const spacing = {};`), {
      message: /is an empty object/,
    });
  });

  testCase("a theme module that does not parse names itself", () => {
    assert.throws(() => readScale(`export const spacing = { md: `), {
      message: /theme-\d+\.stylex\.ts/,
    });
  });
});
