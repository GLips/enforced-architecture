// The architecture rules govern application source. Tests and one-off scripts sit outside that
// contract on purpose: a test may import whatever it needs to exercise a seam, and a script is not
// part of the shipped module graph. The patterns live here once, so a new rule inherits the same
// edge instead of carrying a fresh (and subtly different) copy — five of this catalog's GritQL
// rules over-matched because each template pasted its own near-copy of this regex.
//
// GENERATED and AMBIENT files are exempt for a different reason: nobody wrote them, so a finding
// against one names no edit anyone can make. `.d.ts` in particular declares types and emits no
// runtime edge at all. These two match `source.exclude` in the structural tier's config, and the
// matching is deliberate — a file one tier governs and the other does not is one edge with two
// answers, which is the failure `lint/policy/` exists to remove. `/scripts/` is the same claim from
// the other side: it is exempt here and excluded there for the same reason.
//
// ── Adapt ──
// Extend TEST_PATH if the project marks specs some other way (`*.spec.ts`, a `test/` root), and
// SCRIPT_PATH if one-off tooling lives somewhere other than `scripts/`. Every rule that calls
// `isArchitectureExemptPath` inherits the change, which is the point — and whatever you change
// here, change the structural tier's `source.exclude` to match.
const TEST_PATH = /\.test\.[tj]sx?$|__tests__|\/src\/test\//;
const SCRIPT_PATH = /\/scripts\//;
const UNAUTHORED_PATH = /\.gen\.[tj]sx?$|\.d\.ts$/;

export function isArchitectureExemptPath(filename: string): boolean {
  return TEST_PATH.test(filename) || SCRIPT_PATH.test(filename) || UNAUTHORED_PATH.test(filename);
}

/** Rules that only make sense against rendered UI gate on this rather than on being in `src/`. */
export function isComponentFile(filename: string): boolean {
  return filename.endsWith(".tsx");
}
