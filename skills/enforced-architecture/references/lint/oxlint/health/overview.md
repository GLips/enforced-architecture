# health — Code quality metrics

The per-file half — four rules, about what a reader has to hold: a comment's length, a function's
control flow, how much state it has in flight, and how wide a surface it hands back. What a whole
*tree* weighs is the other half: [../../structural/health/overview.md](../../structural/health/overview.md).

| Rule | Blocking | What it buys |
|---|---|---|
| [no-long-comments](no-long-comments.ts) | Yes | No run of comment goes past `maxWords` words or `maxLines` lines, so every comment in the tree is short enough that somebody re-reads it on the edit that invalidates it |
| [cognitive-complexity](cognitive-complexity.ts) | Warns | Each function whose control flow costs a reader more than `threshold` to follow, so the ones that have to be read whole are named before somebody has to rewrite one |
| [accumulator-count](accumulator-count.ts) | Warns | Each function holding `threshold` or more mutable values at once — the kind of hard that no control-flow metric can see |
| [return-width](return-width.ts) | Warns | Each function past `minLines` long that returns `minMembers` or more members, which is a module wearing one function's name |

## Why one blocks and three warn

`no-long-comments` blocks, and that is the whole of why it is worth having. A warning about comment
length is one an agent writes past on the way to finishing the task, and the comment it wrote
outlives the code it described. Shortening a comment also fits in the commit that tripped it.

The other three warn. Splitting a complicated function is a decision about what its phases *are*, and
that decision does not fit in the change that pushed it over the line — a hard gate there stops the
work mid-change instead of shaping it. Each reports a number a reader uses to decide what to split
next, which is the posture `react/hook-count` and `react/prop-count` take for the same reason.

**Use the defaults for no-long-comments** — They're picked with good reason. If you need more than
60 words in a single comment, there is a problem with the code. Most of the time you don't need more
even if you maybe thought you did.

The other defaults — 20, 4, and the pair (10, 150) — were measured against hand-labelled functions
in two real codebases rather than taken from a paper. Each rule's header says what against and what
moving the number costs. Set them from this codebase the way `health/file-size`'s two are set — in
one visible place. What is not on offer is a list of functions that may be complicated.

## Why three numbers about one function

They are near-orthogonal, and each is blind where the others look.

`cognitive-complexity` counts breaks in linear flow, weighted by how deep they nest. It is quiet
about a function whose branches are all shallow and obvious and whose difficulty is that seven
values are in flight across them — the shape code takes when it grew a phase at a time.
`accumulator-count` is that second number. On the two codebases these were built against, the worst
function in each had a nesting depth of two and five accumulators: unremarkable on one list and at
the top of the other.

`return-width` asks a third question, about SHAPE rather than insides: a long body handing back a
wide object is several jobs joined by nothing but the `return`, and the members are the exports the
module would have had. Both of its numbers are needed. The widest return in the codebase these were
measured against hands back 27 members from 32 lines — a design-token map, and exactly right — so a
rule counting members alone reports the shape it should leave alone.

None subsumes another, and a project taking one gets a third of the signal. All three share one
answer to where a function ends — [`../lib/function-subjects.ts`](../lib/function-subjects.ts) — so
the numbers always describe the same body. `sonarjs/cognitive-complexity` is deliberately not
enabled beside `arch/cognitive-complexity`; the config says why.

## What none of them measures

All three are strictly intra-function, and none knows the call graph. A module that reads as a long
list of small well-named functions scores low on all three — correctly — even when the relationships
*between* those functions are what makes it hard. That is a question about the shape of a tree, and
`structural/health/trampolines` asks part of it.

None can see UNIFORMITY. Fourteen near-identical guard clauses read as one thing and score as
fourteen; the guard adjustment in `cognitive-complexity` makes such a function cheaper without
making it free, and its header states that as negative space. Repetition across *files* is not a
lint question at all — `setup/jscpd.json` owns the byte-identical kind, and a repeated idiom with
variation wants an ast-grep pattern run as a one-off census, not a standing gate.

Adoption mechanics, the spec contract, and what part of the tree owns each rule's subject: [../../overview.md](../../overview.md).
