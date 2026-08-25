// ─── health/no-long-comments ──────────────────────────────────────────
//
// Makes sure: No run of comment goes past maxWords words or maxLines lines,
// headerMultiple times that for the run opening a file. Past that nobody
// re-reads it on the edit that invalidates it, and it becomes a record of how
// the code used to work that no reader can date.
//
// A RUN is comments separated by nothing but whitespace. Respelling a block as
// line comments, or pressing Enter, measures the same. Only code ends one.
//
// NEGATIVE SPACE: nothing reads a comment's text, so narration and rationale
// weigh alike and a licence header reports. A line of code splits a run and
// evades the count, left open: that line is one a reviewer sees. The
// mechanisms below state the rest.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { type Comment, type ESTree } from "@oxlint/plugins";
import { numericRuleOption } from "../lib/rule-options.ts";

const DEFAULT_MAX_WORDS = 60;
const DEFAULT_MAX_LINES = 15;

/**
 * The run introducing a whole module answers "what is this file" and is read once per file rather
 * than once per edit, so it earns more room than a note beside a branch. A multiple rather than a
 * second pair of thresholds: two absolute numbers can be set so the header ceiling is the tighter
 * one, and this cannot.
 */
const DEFAULT_HEADER_MULTIPLE = 2;

/**
 * A token is a word when it holds a letter or a digit. Box drawing, a bullet and a bare `*` are
 * layout, not content, and charging for them ties the verdict to the wrapping. No
 * JSDoc-gutter strip beside this: a leading `*` fails the test already, and a second mechanism
 * dropping the same asterisks leaves each looking load-bearing while neither is.
 */
const HOLDS_A_WORD = /[\p{L}\p{N}]/u;

function wordCount(comment: Comment): number {
  let words = 0;
  for (const line of comment.value.split("\n")) {
    for (const token of line.split(/\s+/u)) {
      if (HOLDS_A_WORD.test(token)) words += 1;
    }
  }
  return words;
}

/** Summed per comment, never the span from the first to the last: a blank line is not a line. */
function lineCount(comment: Comment): number {
  return comment.loc.end.line - comment.loc.start.line + 1;
}

/**
 * The JSX comment stack, the one place punctuation nobody wrote on purpose splits a run. Two braced
 * comments on consecutive lines have `}` and `{` between them, so a plain whitespace test reads
 * eight as eight and the ceiling never binds in a component. Closing then opening only, so
 * `} else {`, an element, and a `}` closing a function each still end the run.
 */
const JSX_BETWEEN_COMMENTS = /^\s*\}\s*\{\s*$/u;

/** Maximal stretches of comment, in source order. */
function commentRuns(comments: readonly Comment[], text: string): Comment[][] {
  const runs: Comment[][] = [];
  let open: Comment[] | null = null;
  let previousEnd = 0;

  for (const comment of comments) {
    // Not prose, and it can only be the first thing in a file, so skipping it cannot split a run.
    if (comment.type === "Shebang") continue;

    // The source TEXT between two comments, never their line numbers: line arithmetic cannot see
    // the `x = 1;` sitting between two comment lines, which is the one thing that has to end a run.
    const between = text.slice(previousEnd, comment.start);
    if (open !== null && (between.trim() === "" || JSX_BETWEEN_COMMENTS.test(between))) {
      open.push(comment);
    } else {
      open = [comment];
      runs.push(open);
    }
    previousEnd = comment.end;
  }

  return runs;
}

/**
 * Whether `run` is the one introducing the file — it opens before the first statement does.
 *
 * Asked of the program body rather than of the offset, because "nothing but whitespace precedes it"
 * is false under a shebang and a file with one is the same file.
 */
function introducesTheFile(run: Comment[], program: ESTree.Program): boolean {
  const firstStatement = program.body[0];
  return firstStatement === undefined || run[0].start < firstStatement.start;
}

// SCOPE, from the wrapper rather than from anything below: silent outside the declared trees, and
// on the test, script, generated and ambient files `isArchitectureExemptSourcePath` names inside
// them. Neither silence is coverage.
export const noLongCommentsRule = defineTreeRule({
  meta: {
    type: "problem",
    schema: [
      {
        type: "object",
        properties: {
          maxWords: { type: "integer", minimum: 1 },
          maxLines: { type: "integer", minimum: 1 },
          headerMultiple: { type: "integer", minimum: 1 },
        },
        additionalProperties: false,
      },
    ],
    defaultOptions: [
      {
        maxWords: DEFAULT_MAX_WORDS,
        maxLines: DEFAULT_MAX_LINES,
        headerMultiple: DEFAULT_HEADER_MULTIPLE,
      },
    ],
    messages: {
      tooManyWords:
        "This comment runs to {{words}} words (limit: {{maxWords}}). At that length nobody re-reads it on the edits that invalidate it, so it becomes a record of how the code used to work with no way to tell which sentences still hold. Keep what the code cannot say — why this shape, what breaks if it is reordered, what it deliberately does not handle — and delete the narration of what the lines below already show. If the explanation really is this large it is documentation: put it where a reader finds it without opening this file, and leave a one-line pointer.",
      tooManyLines:
        "This comment occupies {{lines}} lines and only {{words}} words (limits: {{maxLines}} lines, {{maxWords}} words) — a banner, a boxed diagram, or a column of fragments. Keep the line or two that names what the thing is and drop the frame around it. Every one of these lines also counts toward the file a reader has to hold, which is what `health/file-size` measures.",
    },
  },
  create(context) {
    const option = context.options[0];
    const maxWords = numericRuleOption(option, "maxWords", DEFAULT_MAX_WORDS);
    const maxLines = numericRuleOption(option, "maxLines", DEFAULT_MAX_LINES);
    const headerMultiple = numericRuleOption(option, "headerMultiple", DEFAULT_HEADER_MULTIPLE);

    return {
      Program(program) {
        const { sourceCode } = context;

        for (const run of commentRuns(sourceCode.getAllComments(), sourceCode.text)) {
          const allowance = introducesTheFile(run, program) ? headerMultiple : 1;
          const wordCeiling = maxWords * allowance;
          const lineCeiling = maxLines * allowance;

          const loc = { start: run[0].loc.start, end: run[run.length - 1].loc.end };
          const words = run.reduce((total, comment) => total + wordCount(comment), 0);

          // One report per run, word ceiling first. A run over both is over the word ceiling because
          // of its prose, and `tooManyWords` names that edit; reporting both would ask for the frame
          // to go and leave the essay.
          if (words > wordCeiling) {
            context.report({
              loc,
              messageId: "tooManyWords",
              data: { words, maxWords: wordCeiling },
            });
            continue;
          }

          const lines = run.reduce((total, comment) => total + lineCount(comment), 0);
          if (lines > lineCeiling) {
            context.report({
              loc,
              messageId: "tooManyLines",
              data: { lines, words, maxLines: lineCeiling, maxWords: wordCeiling },
            });
          }
        }
      },
    };
  },
});
