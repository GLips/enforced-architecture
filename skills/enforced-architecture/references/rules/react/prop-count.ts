// ─── react/prop-count ─────────────────────────────────────────────────
//
// Tag:       react
// Mechanism: structural script (counts across a file set)
// Blocking:  No — a warning. A wide prop surface is a smell, and the developer
//            decides whether decomposition or the current interface is right.
//
// Prevents:  Components with a prop surface wide enough to be hard to use
//            correctly — usually a component doing too much, props that always
//            travel together, or data drilled through an intermediary.
//
// See react/prop-count.md for why there are two counting strategies and for the
// four ways this check has gone silent.
//
// ──────────────────────────────────────────────────────────────────────

import {
  findComponentDeclarations,
  matchingBrace,
} from "../scripts/component-declarations.ts";
import type { ArchitectureConfig } from "../scripts/config.ts";
import {
  blankComments,
  collectFiles,
  readFile,
  splitTopLevel,
  stripCommentsAndStrings,
  toProjectPath,
  type Finding,
  type StructuralCheck,
} from "../scripts/lib.ts";

/** A property signature, and its name. Method signatures deliberately do not match. */
const PROPS_MEMBER = /^(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:/;

export const propCountCheck: StructuralCheck = {
  id: "react/prop-count",

  run({ config }) {
    const { targetDirs, threshold } = config.checks["react/prop-count"];
    // Deduplicated because two target globs may resolve to the same file, and a
    // component reported twice reads as two components.
    const files = new Set(
      targetDirs.flatMap((dir) =>
        collectFiles(config, dir, "**/*.tsx", { fromSourceRoot: true }),
      ),
    );

    return [...files].sort().flatMap((absolute) => scanFile(config, absolute, threshold));
  },
};

function scanFile(
  config: ArchitectureConfig,
  absolute: string,
  threshold: number,
): Finding[] {
  const file = toProjectPath(config, absolute);
  // Block comments blanked before the per-line strip, so neither walk below can
  // be thrown off by a brace or paren inside a comment or a string. Blanking
  // rather than stripping keeps every reported line number true to the file.
  const code = blankComments(readFile(absolute)).split("\n").map(stripCommentsAndStrings);
  const source = code.join("\n");
  const findings: Finding[] = [];

  for (const component of findComponentDeclarations(code)) {
    // A wrapper's signature is the `memo`/`forwardRef` call's arguments; the
    // props belong to the function inside it, which is found on its own line.
    if (component.kind === "wrapper") continue;

    if (component.signature === null) {
      findings.push({
        severity: "error",
        file,
        line: component.line,
        message:
          `Could not read ${component.name}'s parameter list: the paren never closes.\n` +
          `prop-count is blind to this component until that is resolved, and a component\n` +
          `the check cannot read is one it never reports on — look for an unbalanced paren\n` +
          `in a template literal above the declaration.`,
      });
      continue;
    }

    const count =
      propsFromType(source, component.name) ??
      propsFromDestructure(component.signature.params);
    if (count === null || count < threshold) continue;

    findings.push({
      severity: "warning",
      file,
      line: component.line,
      message:
        `${component.name} has ${count} props (threshold: ${threshold}).\n` +
        `Decompose into smaller components, group props that always travel together\n` +
        `into one object, or lift shared data into context. If the wide surface is\n` +
        `deliberate — a design-system primitive, or a wrapper forwarding to a third\n` +
        `party — raise the threshold in the project's architecture config.`,
    });
  }

  return findings;
}

/**
 * Property signatures in the component's `type <Name>Props = { … }` or
 * `interface <Name>Props { … }`.
 *
 * Anything but `{` is allowed between the name and the body, because
 * `interface OptionListProps<T> {` is the ordinary generic spelling and a
 * pattern requiring `{` or `=` adjacent to the name does not see it — which
 * silently demotes every generic component to the destructure fallback.
 */
function propsFromType(source: string, component: string): number | null {
  const declaration = new RegExp(`(?:type|interface)\\s+${component}Props\\b[^{]*\\{`).exec(
    source,
  );
  if (declaration === null) return null;

  const open = source.indexOf("{", declaration.index);
  const close = matchingBrace(source, open);
  if (close === -1) return null;

  let count = 0;
  // Members separate on newlines, `;`, or `,`, and one line can hold several.
  // Splitting at top level only means a nested object literal's own members stay
  // with their parent instead of each counting as a prop.
  for (const member of splitTopLevel(source.slice(open + 1, close), ";,\n")) {
    const name = PROPS_MEMBER.exec(member.trim())?.[1];
    if (name !== undefined && name !== "children") count++;
  }
  return count;
}

/**
 * Fallback: the identifiers in the parameter list's `{ … }` destructuring pattern.
 *
 * The counted region ends at the destructure's OWN closing brace. A component
 * annotated with an inline type literal — `({ a, b }: { a: string; b: string })`,
 * which is how most of them are written — puts a second brace pair immediately
 * after the first, and reading to the last brace in the signature counts every
 * name a second time. That doubling carries a seven-prop component past an
 * eight-prop threshold, and over-matching is the defect that teaches people to
 * scroll past a check.
 */
function propsFromDestructure(params: string): number | null {
  const open = params.indexOf("{");
  if (open === -1) return null;
  const close = matchingBrace(params, open);
  if (close === -1) return null;

  let count = 0;
  for (const entry of splitTopLevel(params.slice(open + 1, close), ",")) {
    // `...rest` is explicit forwarding and `children` is a structural
    // convention; neither is a data dependency the component chose to accept.
    const name = entry.trim().split(/[:=]/)[0]?.trim() ?? "";
    if (name === "" || name.startsWith("...") || name === "children") continue;
    count++;
  }
  return count;
}
