# health — Code quality metrics

The per-file half — one rule, about how much a comment costs to keep true. What a whole *tree*
weighs is the other half: [../../structural/health/overview.md](../../structural/health/overview.md).

| Rule | Blocking | What it buys |
|---|---|---|
| [no-long-comments](no-long-comments.ts) | Yes | No run of comment goes past `maxWords` words or `maxLines` lines, so every comment in the tree is short enough that somebody re-reads it on the edit that invalidates it |

It blocks, and that is the whole of why it is worth having. A warning about comment length is one an
agent writes past on the way to finishing the task, and the comment it wrote outlives the code it
described.

**Set the three numbers from the codebase, not from the defaults** — the same instruction the
structural half opens with, and it matters more here. `{ maxWords: 60, maxLines: 15, headerMultiple:
2 }` is calibrated for application source. A tree whose modules open with a rationale header raises
`headerMultiple`; one whose prose is legitimately denser raises `maxWords`. What is not on offer is
a list of files that may be long.

## What a run is

The subject is a **run**: consecutive comments with nothing but whitespace between them count as
one. That is what stops the limit from being a formatting exercise. A rule measuring one comment at
a time is beaten by respelling the block as line comments, or by pressing Enter between the
paragraphs, and neither edit changes a thing for the reader.

Two exceptions to "nothing but whitespace", each a structural fact rather than a list:

- **A closing brace followed by an opening one** keeps a run open, because that is what sits between
  two braced comments in JSX and it is the idiom there, not evasion. Closing-then-opening only: an
  element between them, a `} else {`, or a bare `}` ending a function each still end the run.
- **The run opening the file** — the one starting before the first statement — is measured against
  `headerMultiple` times both ceilings. It introduces the whole module and is read once per file
  rather than once per edit. A multiple rather than a second pair of numbers, so a project cannot
  set a header ceiling tighter than its body ceiling by accident.

## Negative space

It reports on a licence header, and there is no exemption coming. Nothing structural tells one apart
from an essay at the top of a file, and the exemption that would carry it — the file's first comment
— already exists as an allowance with a number on it rather than an escape with a name on it.

A run stops at the first token of code, so two long comments split by a line of dead code are two
runs. That bypass is left open because its cost is a line a reviewer can see.

Nothing reads a comment's text, so narration and rationale weigh the same. Length is the signal
that is available.

There is no exemption by content — a licence header, a JSDoc block, a `SAFETY:` justification and a
commented-out function are measured alike, because a list of comment kinds that may be long is a
list an adopting project extends until nothing is measured. That leaves this rule and
`types/require-safety-comment` speaking to the same comment, and they stay jointly actionable: that
rule asks for one sentence naming an invariant, and a sentence is not sixty words.

## "Word" means something narrower here than in `doc-budgets`

`health/doc-budgets` counts every whitespace-separated token, deliberately: a markdown table's
pipes and rules are content a reader scans. This rule counts only tokens holding a letter or a
digit, so box drawing, a JSDoc `*` gutter and a `-` bullet cost nothing — they are how a comment is
laid out, and charging for them would tie the verdict to the wrapping. Two measurements, one word
about them; a 60-word comment ceiling and a 3,000-word doc ceiling are not in the same unit.

Adoption mechanics, the spec contract, and what part of the tree owns each rule's subject: [../../overview.md](../../overview.md).
