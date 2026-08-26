// ─── A token scale, read out of the theme module's source ─────────────
//
// Makes sure of nothing on its own. One question, for the config file to ask
// while it builds `style/token-equality`'s scales:
//
//   `readThemeScaleFromSource` — which token names and literal values does this
//   theme module's `export const <name>` write.
//
// ── Why the scale is READ and not IMPORTED ────────────────────────────
//
// A theme module of plain constants can be imported, and importing it is the
// obvious shape. It stops working the moment the project's tokens are
// COMPILE-TIME, and the mainstream CSS-in-TS systems are: StyleX,
// vanilla-extract, Panda. Their token definitions are Babel or bundler inputs
// rather than modules with a runtime.
//
// StyleX is the worked example and the worst of the three. Its runtime
// `defineVars` is `function stylexDefineVars() { throw … }`, and `create`,
// `createTheme` and `defineConsts` are the same — there is no non-throwing entry
// point to import. So a config file that imports a `.stylex.ts` theme module
// does not get bad scales, it THROWS AT CONFIG LOAD and takes the whole
// structural tier down before `assertGoverningConfig` can say anything useful
// about why. A project that then works around the crash by leaving the scales
// `{}` gets the check's silent state instead: every style surface walked,
// nothing reported, nothing in the config reading as off.
//
// Compiling first does not rescue the import. Post-Babel a `defineVars` scale
// holds `"var(--x11ox8fn)"` where the check wants a CSS length, so `toPxTokens`
// parses NaN out of every entry and builds an empty map — the same silence,
// reached the long way round.
//
// The literals a human wrote in the source are the only representation of a
// scale that all of these systems hold. That is what this reads.
//
// ── Why every miss THROWS ─────────────────────────────────────────────
//
// A renamed export, a moved file, a value spelled as an expression: each one
// would otherwise hand back a short or empty scale, and a short scale is a check
// that reports on some tokens and stays quiet on the rest, with a green run and
// nothing in the diff. `assertGoverningConfig` refuses the same class of value
// one layer up. This refuses the class it cannot see, because by the time the
// config object exists a scale that lost three tokens is indistinguishable from
// a scale that has two.
//
// ── The shape it reads ────────────────────────────────────────────────
//
// A top-level `export const <name> =` whose initializer is an object literal, or
// a single-argument call taking one: `defineVars({ … })`, `defineConsts({ … })`,
// `defineTokens({ … })`. A call whose object is not its only argument —
// `createGlobalTheme(":root", { … })` — is not read, because guessing which
// argument holds the scale is how a reader starts matching the wrong one; give
// that shape its object as a named export and point this at that.
//
// `as const` and `satisfies` are unwrapped wherever they sit, and reading the
// `as const` form is not optional politeness: it is how a token scale is written
// in TypeScript, because it is what makes the token names literal types instead
// of `string`. Both erase at compile time, so neither can change a value this
// reads.
//
// A property whose value is not a string or number literal is REFUSED, by name,
// rather than skipped. A spread, a computed key, a reference to another token, a
// StyleX responsive value (`{ default: "1rem", "@media …": "2rem" }`) — none of
// them has a length at this layer, and dropping one is the short scale above:
// the token stops being compared against and every raw px equal to it goes
// quiet. The refusal says which properties, so the fix is either to spell that
// token as a literal or to point this at a scale that does.
// ──────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import type { Expression, ObjectExpression } from "oxc-parser";
import { parseSourceModule } from "./import-scanning.ts";

/**
 * One scale from a theme module, as the literals its source writes.
 *
 * `path` is absolute — resolve it in the config file against
 * `import.meta.dirname`, the same way `projectRoot` is resolved, so the scales
 * do not depend on the directory the check command was run from.
 */
export function readThemeScaleFromSource(options: {
  path: string;
  exportName: string;
}): Record<string, string | number> {
  const { path, exportName } = options;
  const object = findScaleObject(readFileSync(path, "utf8"), path, exportName);

  if (object === undefined) {
    throw new Error(
      `no top-level \`export const ${exportName}\` with an object literal in ${path}. A token ` +
        `scale is read as \`export const ${exportName} = { token: "1rem", … }\` or ` +
        `\`export const ${exportName} = defineVars({ token: "1rem", … })\`. It is read from the ` +
        `source rather than imported because a compile-time token module has no runtime to ` +
        `import — see theme-scale.ts.`,
    );
  }

  const { scale, unreadable } = literalEntriesOf(object);

  if (unreadable.length > 0) {
    throw new Error(
      `\`export const ${exportName}\` in ${path} writes ${unreadable.length} entr` +
        `${unreadable.length === 1 ? "y" : "ies"} with no literal length: ${unreadable.join(", ")}. ` +
        `Each one would drop out of the scale, and style/token-equality would then stay quiet on ` +
        `every raw px equal to that token while reporting the rest. Spell the value as a string ` +
        `or number literal, or point this at a scale that does.`,
    );
  }

  if (Object.keys(scale).length === 0) {
    throw new Error(
      `\`export const ${exportName}\` in ${path} is an empty object, so style/token-equality ` +
        `would walk every style surface and compare it against nothing. A scale with no tokens ` +
        `is this check switched off with the run still green.`,
    );
  }

  return scale;
}

/**
 * The object literal the named export writes, or `undefined` when no export of
 * that name carries one.
 *
 * Finding the object and reading it are separate because they fail differently:
 * a wrong name or path finds nothing, while a theme module written in a spelling
 * this cannot read finds the object and refuses its contents. One `undefined`
 * for both would send every adopter to the wrong fix half the time.
 */
function findScaleObject(
  source: string,
  path: string,
  exportName: string,
): ObjectExpression | undefined {
  const parsed = parseSourceModule({ path, source });

  for (const statement of parsed.program.body) {
    if (statement.type !== "ExportNamedDeclaration") continue;
    if (statement.declaration?.type !== "VariableDeclaration") continue;

    for (const declarator of statement.declaration.declarations) {
      if (declarator.id.type !== "Identifier") continue;
      if (declarator.id.name !== exportName) continue;

      // The name matched, so this declarator is the answer whatever its shape.
      // Reading on would hide it behind a `continue` and let some later
      // declarator that cannot legally share the name decide instead.
      return scaleObjectOf(declarator.init);
    }
  }

  return undefined;
}

/**
 * The object literal an initializer holds, directly or as a call's only argument.
 *
 * `as const` and `satisfies` are unwrapped first, and that is not politeness
 * toward two spellings — `as const` is how a token scale is written in
 * TypeScript at all. It is what gives the token NAMES literal types, so
 * `spacing.m` narrows and a typo in a style prop is a compile error rather than
 * `number`. A reader that stops at `TSAsExpression` refuses the idiomatic scale
 * and reads only the untyped one, which is the shape a project moves away from
 * as it matures.
 *
 * Both wrappers erase at compile time and neither can change a literal, so
 * unwrapping cannot make this read a value the module does not write. That is
 * the property the CALL arm does not have, which is why it is not recursive:
 * exactly one call may sit between the export and its object. A call is a
 * transform, so reading through a nested one — `defineVars(pickHalf({ … }))` —
 * would report a scale the module does not write, and it would do it silently,
 * which is the one outcome this module is built to refuse.
 */
function scaleObjectOf(init: Expression | null): ObjectExpression | undefined {
  if (init === null) return undefined;
  const unwrapped = withoutTypeWrappers(init);
  if (unwrapped.type === "ObjectExpression") return unwrapped;
  if (unwrapped.type !== "CallExpression" || unwrapped.arguments.length !== 1) return undefined;
  const [argument] = unwrapped.arguments;
  if (argument === undefined || argument.type === "SpreadElement") return undefined;
  const inner = withoutTypeWrappers(argument);
  return inner.type === "ObjectExpression" ? inner : undefined;
}

/** `as const` and `satisfies` peeled off, however many of them are stacked. */
function withoutTypeWrappers(node: Expression): Expression {
  let cursor = node;
  while (cursor.type === "TSAsExpression" || cursor.type === "TSSatisfiesExpression") {
    cursor = cursor.expression;
  }
  return cursor;
}

/**
 * Every `name: <string | number literal>` pair the object writes, and every
 * entry that is not one — described well enough to find in the file.
 *
 * The two come back together because the caller needs the count of what it could
 * not read to decide anything. Returning the scale alone puts the reader in the
 * position of comparing a token count against a file, which is the check the
 * scale exists to avoid doing by hand.
 */
function literalEntriesOf(object: ObjectExpression): {
  scale: Record<string, string | number>;
  unreadable: string[];
} {
  const scale: Record<string, string | number> = {};
  const unreadable: string[] = [];

  for (const property of object.properties) {
    if (property.type !== "Property") {
      // A spread names no token of its own and carries every token of whatever
      // it spreads, so an object holding one is a scale this cannot size.
      unreadable.push("a spread element");
      continue;
    }

    // `md:` and `"2xl":` are one token written two ways, and a reader that takes
    // only the identifier form loses every token whose name opens with a digit —
    // which is most size scales.
    const { key, value } = property;
    const name =
      !property.computed && key.type === "Identifier"
        ? key.name
        : key.type === "Literal" && typeof key.value === "string"
          ? key.value
          : undefined;
    if (name === undefined) {
      unreadable.push("a computed key");
      continue;
    }

    if (value.type !== "Literal" || (typeof value.value !== "string" && typeof value.value !== "number")) {
      unreadable.push(name);
      continue;
    }

    scale[name] = value.value;
  }

  return { scale, unreadable };
}
