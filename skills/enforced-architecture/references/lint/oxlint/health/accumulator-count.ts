// ─── health/accumulator-count ─────────────────────────────────────────
//
// Shows: Each function holding `threshold` or more ACCUMULATORS at once,
// and the names. An accumulator is a mutable binding the function writes
// in two or more separate places. It is the thing a reader must carry from
// the top of the function to the bottom, because no branch that touches it
// can be understood without every other branch that touches it.
//
// This is the number no control-flow metric has. `health/cognitive-
// complexity` counts branches; a function can have shallow, obvious
// branches and still be unreadable because seven values are in flight
// across them. Measured on two codebases, the worst function in each was
// the one this rule found and the branch count did not: nesting two,
// nothing clever anywhere, and five accumulators written from thirty-odd
// places. Neither rule subsumes the other and neither replaces the other.
//
// TWO writes, not one. `const rows = []; for (…) rows.push(x)` is one
// accumulation with one story, and a reader follows it without holding
// anything — that is the shape a rule reporting every `let` would punish.
// What costs is the SECOND place: once a value is written from two
// branches, its state at any line is a question about both.
//
// A `const` counts when its VALUE is mutable and mutated — an array, an
// object literal, a Map or a Set. The binding being const says nothing
// about what the reader has to hold; `const seen = new Set()` written from
// four branches is four branches of state.
//
// What a function reads is not counted, and neither are its parameters.
// An input is a fact the function is handed; an accumulator is a fact it
// is building, and only the second one changes under the reader.
//
// The function's own body is what a READER reads, so an anonymous callback
// inside it is part of it and a NAMED helper is not — one answer, in
// `lib/function-subjects.ts`, shared with `health/cognitive-complexity` so
// the two numbers describe the same function.
//
// It warns and does not fail the build. Unlike a long file, an
// accumulator cannot be lifted out mechanically: taking one apart means
// deciding what the phases of the function actually are, which is not work
// that fits in the commit that tripped the count. A hard gate here stops
// the change instead of shaping it. The threshold is the knob.
//
// NEGATIVE SPACE, three cases, each left open on purpose:
//   - A destructured binding (`let { a, b } = …`) is not tracked. There is
//     no single name to attribute writes to, and the shape is rare enough
//     that guessing at one would cost more than it caught.
//   - A binding written in ONE place inside a loop is one site and does
//     not count, however many times it runs. The reader follows one story.
//   - A write through an alias (`const alias = rows; alias.push(x)`) is
//     attributed to the alias. Per-file syntax cannot follow a value, and
//     a rule that pretended to would be wrong in the direction that
//     silently under-reports.
//
// SCOPE, from the wrapper rather than from anything below: silent outside
// the declared trees, and on the test, script, generated and ambient files
// `isArchitectureExemptSourcePath` names inside them. Neither silence is
// coverage.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { type ESTree } from "@oxlint/plugins";
import {
  functionSubjectName,
  functionSubjects,
  walkOwnBody,
  type FunctionNode,
} from "../lib/function-subjects.ts";
import { numericRuleOption } from "../lib/rule-options.ts";
import { withoutTransparentWrappers } from "../lib/transparent-wrappers.ts";

/**
 * Measured rather than picked. Across roughly 2,600 functions in two codebases, four functions
 * reach 3 and two reach 4 — and those two are, independently, the two functions in those trees
 * anybody would name as the hardest to read. Three catches a character-scanner state machine
 * (`out`, `inString`, `escaped`), which is three accumulators by nature and nothing to report.
 */
const DEFAULT_THRESHOLD = 4;

/** The number of separate places a binding is written before it is something a reader carries. */
const WRITES_THAT_MAKE_AN_ACCUMULATOR = 2;

/**
 * Methods that change a collection in place. Names only, because per-file syntax has no types:
 * `queue.add(x)` counts whether `queue` is a Set or a domain object, and a domain object with an
 * `add` is accumulating too.
 */
const MUTATING_METHODS = new Set([
  "add",
  "clear",
  "delete",
  "fill",
  "pop",
  "push",
  "reverse",
  "set",
  "shift",
  "sort",
  "splice",
  "unshift",
]);

const MUTABLE_VALUE_CONSTRUCTORS = new Set(["Map", "Set", "WeakMap", "WeakSet"]);

/**
 * Whether `const x = <this>` leaves the reader something that can still change under them.
 *
 * Through the casts, because `const totals = {} as Record<string, number>` is the ordinary spelling
 * of an empty accumulator in TypeScript — reading only the bare literal makes the annotation a way
 * to disappear from this count, and it is a way an author reaches for without meaning to.
 */
function isMutableValue(node: ESTree.Node): boolean {
  const init = withoutTransparentWrappers(node);
  if (init.type === "ArrayExpression" || init.type === "ObjectExpression") return true;
  return (
    init.type === "NewExpression" &&
    init.callee.type === "Identifier" &&
    MUTABLE_VALUE_CONSTRUCTORS.has(init.callee.name)
  );
}

/** The binding a write lands on: `x =`, `x.field =`, `x[i] =` and `(x as T).field =` all write `x`. */
function writtenBindingName(target: ESTree.Node): string | undefined {
  const node = withoutTransparentWrappers(target);
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression") {
    const object = withoutTransparentWrappers(node.object);
    if (object.type === "Identifier") return object.name;
  }
  return undefined;
}

function accumulatorNames(fn: FunctionNode): string[] {
  const declared = new Set<string>();
  // Offsets rather than a count: `x += 1` inside a loop is one place however often it runs, and the
  // whole claim of this rule is about places rather than about times.
  const writeSites = new Map<string, Set<number>>();

  const noteWrite = (name: string | undefined, at: number) => {
    if (name === undefined) return;
    let sites = writeSites.get(name);
    if (sites === undefined) writeSites.set(name, (sites = new Set()));
    sites.add(at);
  };

  walkOwnBody(fn, (node) => {
    if (node.type === "VariableDeclaration") {
      for (const declarator of node.declarations) {
        if (declarator.id.type !== "Identifier") continue;
        if (node.kind === "let" || node.kind === "var") {
          declared.add(declarator.id.name);
        } else if (declarator.init !== null && isMutableValue(declarator.init)) {
          declared.add(declarator.id.name);
        }
      }
      return;
    }

    if (node.type === "AssignmentExpression") {
      noteWrite(writtenBindingName(node.left), node.start);
      return;
    }

    if (node.type === "UpdateExpression") {
      noteWrite(writtenBindingName(node.argument), node.start);
      return;
    }

    if (node.type !== "CallExpression") return;
    const callee = withoutTransparentWrappers(node.callee);
    if (callee.type !== "MemberExpression" || callee.computed) return;
    if (MUTATING_METHODS.has(callee.property.name)) {
      noteWrite(writtenBindingName(callee.object), node.start);
    }
  });

  return [...declared].filter(
    (name) => (writeSites.get(name)?.size ?? 0) >= WRITES_THAT_MAKE_AN_ACCUMULATOR,
  );
}

export const accumulatorCountRule = defineTreeRule({
  meta: {
    type: "suggestion",
    schema: [
      {
        type: "object",
        properties: { threshold: { type: "integer", minimum: 1 } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ threshold: DEFAULT_THRESHOLD }],
    messages: {
      tooMuchState:
        "{{name}} builds {{count}} values at once (threshold: {{threshold}}): {{names}}. Each is written in more than one place, so no branch touching one can be read without every other branch touching it — which is why this function has to be read whole. Look for the phases hiding in it: the accumulators written in the same stretch of the function belong to one step, and that step is a function returning what it built. This warns rather than fails, because splitting them apart is a decision about what the function does, not an edit that fits in the change that tripped the count.",
    },
  },
  create(context) {
    const threshold = numericRuleOption(context.options[0], "threshold", DEFAULT_THRESHOLD);

    return {
      Program(program) {
        for (const fn of functionSubjects(program)) {
          const accumulators = accumulatorNames(fn);
          if (accumulators.length < threshold) continue;

          const { name, target } = functionSubjectName(fn);
          context.report({
            node: target,
            messageId: "tooMuchState",
            data: {
              name,
              count: String(accumulators.length),
              names: accumulators.join(", "),
              threshold: String(threshold),
            },
          });
        }
      },
    };
  },
});
