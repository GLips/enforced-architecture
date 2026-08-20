// The architecture rules govern application source. Tests and one-off scripts sit outside that
// contract on purpose: a test may import whatever it needs to exercise a seam, and a script is not
// part of the shipped module graph. The patterns live here once, so a new rule inherits the same
// edge instead of carrying a fresh (and subtly different) copy — five of this catalog's GritQL
// rules over-matched because each template pasted its own near-copy of this regex.
//
// ── Adapt ──
// Extend TEST_PATH if the project marks specs some other way (`*.spec.ts`, a `test/` root), and
// SCRIPT_PATH if one-off tooling lives somewhere other than `scripts/`. Every rule that calls
// `isArchitectureExemptPath` inherits the change, which is the point.
const TEST_PATH = /\.test\.[tj]sx?$|__tests__|\/src\/test\//;
const SCRIPT_PATH = /\/scripts\//;

export function isArchitectureExemptPath(filename: string): boolean {
  return TEST_PATH.test(filename) || SCRIPT_PATH.test(filename);
}

/** Rules that only make sense against rendered UI gate on this rather than on being in `src/`. */
export function isComponentFile(filename: string): boolean {
  return filename.endsWith(".tsx");
}
