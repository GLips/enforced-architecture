// ─── style/token-equality ─────────────────────────────────────────────
//
// Tag:       style
// Mechanism: structural script (reads the project's own token source)
// Blocking:  Yes
//
// Prevents:  A raw value that is EXACTLY a token on the relevant closed scale —
//            `gap={16}` where `gap="md"` means the same thing. Nothing reads as
//            wrong at the call site, because the value is right; but only one of
//            the two spellings moves when the scale moves.
//
// The scales arrive through `config`, which the PROJECT's config file fills in by
// importing its theme module — see `harness/script-fixtures/config.ts` for the
// worked example. Never restate a scale here: an enforcer carrying its own copy
// of the design system drifts from the thing it guards, and reading the token
// source is the entire reason this axis is a script rather than a lint rule.
//
// Off-scale values (`gap={7}`) pass in silence. That restraint is the design and
// not a gap in it — see style/token-equality.md, "The narrow claim".
//
// ──────────────────────────────────────────────────────────────────────

import {
  blankComments,
  collectFiles,
  readFile,
  toProjectPath,
  toSourcePath,
  type Finding,
  type StructuralCheck,
} from "../scripts/lib.ts";

/**
 * One surface. Group 1 of `pattern` is the prop or key name; the px digits are
 * the first capture after it that matched — the JSX form spells its value two
 * ways (`{16}` and `"16px"`) and exactly one of those groups can be set.
 */
type SurfaceMatcher = {
  pattern: RegExp;
  byPx: Map<number, string>;
  message(name: string, px: number, token: string): string;
};

/** `{16}` or `"16"` / `"16px"`, bounded so only the whole prop value matches. */
const JSX_VALUE = String.raw`\{(\d+)\}|"(\d+)(?:px)?"`;

export const tokenEqualityCheck: StructuralCheck = {
  id: "style/token-equality",

  run({ config }) {
    const { spacingScale, radiusScale, spacingProps, radiusProps, spacingKeys, radiusKeys, exemptPaths } =
      config.checks["style/token-equality"];

    const spacingByPx = toPxTokens(spacingScale);
    const radiusByPx = toPxTokens(radiusScale);

    // Four surfaces, four matchers, and each one has to be exercised on its own:
    // a check fixed on the braced JSX value while the quoted one stopped matching
    // reports three of four violations and looks healthy doing it.
    const matchers: SurfaceMatcher[] = [
      {
        pattern: new RegExp(String.raw`\b(${spacingProps.join("|")})=(?:${JSX_VALUE})`, "g"),
        byPx: spacingByPx,
        message: (name, px, token) =>
          `${name}={${px}} is the spacing token "${token}" written as a number (${describe(spacingByPx)}).\n` +
          `Write ${name}="${token}" instead, so this call site follows the scale when the\n` +
          `scale moves. Off-scale values are deliberately fine raw — this fires only on\n` +
          `an exact match, which is the only case where the fix needs no judgement.`,
      },
      {
        pattern: new RegExp(String.raw`\b(${radiusProps.join("|")})=(?:${JSX_VALUE})`, "g"),
        byPx: radiusByPx,
        message: (name, px, token) =>
          `${name}={${px}} is the radius token "${token}" written as a number (${describe(radiusByPx)}).\n` +
          `Write ${name}="${token}" instead. Off-scale radii are fine raw, and so is a\n` +
          `shape value like borderRadius: "50%" — neither carries a token-equal px.`,
      },
      {
        pattern: new RegExp(String.raw`\b(${spacingKeys.join("|")})\s*:\s*(\d+)\b`, "g"),
        byPx: spacingByPx,
        message: (name, px, token) =>
          `${name}: ${px} is the spacing token "${token}" written as a number (${describe(spacingByPx)}).\n` +
          `Use the scale — a spacing prop (p="${token}") or the token's CSS variable —\n` +
          `instead of the raw px, so this style object cannot drift off-scale while the\n` +
          `named spellings around it follow. Off-scale values are fine raw.`,
      },
      {
        pattern: new RegExp(String.raw`\b(${radiusKeys.join("|")})\s*:\s*(\d+)\b`, "g"),
        byPx: radiusByPx,
        message: (name, px, token) =>
          `${name}: ${px} is the radius token "${token}" written as a number (${describe(radiusByPx)}).\n` +
          `Use the radius prop (radius="${token}") or the token's CSS variable instead of\n` +
          `the raw px. borderRadius: "50%" for a circle stays fine — it is not a px.`,
      },
    ];

    const findings: Finding[] = [];

    for (const absolute of collectFiles(config, "", "**/*.{ts,tsx}", { fromSourceRoot: true })) {
      const sourcePath = toSourcePath(config, absolute);
      if (exemptPaths.some((pattern) => pattern.test(sourcePath))) continue;

      // Blanked rather than stripped so every reported line stays the line on
      // disk, and so a token-equal number quoted in prose cannot false-positive.
      const lines = blankComments(readFile(absolute)).split("\n");

      lines.forEach((line, index) => {
        for (const { pattern, byPx, message } of matchers) {
          for (const match of line.matchAll(pattern)) {
            const name = match[1] ?? "";
            const px = Number(match[2] ?? match[3]);
            const token = byPx.get(px);
            if (token === undefined) continue;

            findings.push({
              severity: "error",
              file: toProjectPath(config, absolute),
              line: index + 1,
              message: message(name, px, token),
            });
          }
        }
      });
    }

    return findings;
  },
};

/**
 * The scale keyed by its px value, which is what a raw value can be compared
 * against. `rem` is × 16 at the browser default; a bare number is already px.
 *
 * Zero is dropped. `none` / `0px` collapses to 0, and 0 is a no-op rather than a
 * spacing decision — rewriting `gap={0}` to a token name would be wrong, so 0
 * must never enter the map in the first place.
 */
function toPxTokens(scale: Record<string, string | number>): Map<number, string> {
  const byPx = new Map<number, string>();
  for (const [token, value] of Object.entries(scale)) {
    const magnitude = typeof value === "number" ? value : Number.parseFloat(value);
    const px = typeof value === "string" && value.trim().endsWith("rem") ? magnitude * 16 : magnitude;
    if (Number.isFinite(px) && px > 0) byPx.set(Math.round(px), token);
  }
  return byPx;
}

/** The whole scale, in the message — naming one token is not enough to fix a habit. */
function describe(byPx: Map<number, string>): string {
  return [...byPx].map(([px, token]) => `${px}=${token}`).join(", ");
}
