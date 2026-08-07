// ─── react/hook-count ─────────────────────────────────────────────────
//
// Tag:       react
// Mechanism: structural script (counts across a file set)
// Blocking:  No — warning only
//
// Prevents:  Components that have quietly accumulated responsibilities. Data
//            fetching, form state, subscriptions, and animation in one render
//            body is a set of custom hooks that was never extracted.
//
// See react/hook-count.md for why the count is per component rather than per
// file, and for the two matcher blind spots this is built around.
//
// ──────────────────────────────────────────────────────────────────────

import {
  findComponentDeclarations,
  readComponentBody,
} from "../scripts/component-declarations.ts";
import {
  collectFiles,
  readFile,
  stripCommentsAndStrings,
  toProjectPath,
  type Finding,
  type StructuralCheck,
} from "../scripts/lib.ts";

/**
 * `useX(`, tolerating a generic type ARGUMENT between the name and the call —
 * `useState<string | null>(…)`, `useRef<HTMLDivElement>(null)`. Without the
 * `<…>` clause every generic-annotated hook is skipped, which in TS React is
 * most of them, and the components undercounted furthest are the crowded ones
 * this exists to find.
 */
const HOOK_CALL = /\buse[A-Z]\w*\s*(?:<[^(;]*>)?\s*\(/g;

export const hookCountCheck: StructuralCheck = {
  id: "react/hook-count",

  run({ config }) {
    const { targetDirs, threshold } = config.checks["react/hook-count"];
    const findings: Finding[] = [];

    for (const dir of targetDirs) {
      for (const absolute of collectFiles(config, dir, "**/*.tsx", { fromSourceRoot: true })) {
        // Blanked per line before anything looks at it: the declaration
        // classifier walks parens and braces, and a `)` inside a string or a
        // trailing comment moves the component boundary.
        const code = readFile(absolute).split("\n").map(stripCommentsAndStrings);

        for (const component of findComponentDeclarations(code)) {
          const { body } = readComponentBody(code, component.index);
          const hooks = countHookCalls(body);
          if (hooks < threshold) continue;

          findings.push({
            severity: "warning",
            file: toProjectPath(config, absolute),
            line: component.line,
            message:
              `${component.name} calls ${hooks} hooks (threshold: ${threshold}).\n` +
              `Group the related ones into a purpose-named custom hook — the hooks that\n` +
              `move together, not the ones that share a type — and put it in a sibling\n` +
              `use*.ts file. If the component is genuinely an orchestrator gathering\n` +
              `independent hooks, leave it: this is a warning for that reason.`,
          });
        }
      }
    }

    return findings;
  },
};

/**
 * Hook calls in a component body, whose lines must already be comment- and
 * string-blanked.
 *
 * Every match on a line, not the first: `const a = useA(), b = useB()` is two
 * hooks, and one-per-line understates exactly the crowded components this rule
 * looks for. `matchAll` rather than a loop over `.test()`, because HOOK_CALL is
 * `/g` and a shared `/g` regex carries a `lastIndex` from call to call that
 * skips every other match.
 */
function countHookCalls(body: string[]): number {
  let count = 0;
  for (const line of body) {
    for (const _ of line.matchAll(HOOK_CALL)) count++;
  }
  return count;
}
