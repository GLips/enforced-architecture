# health — Code quality metrics

The per-file half — one rule, about how much a comment costs to keep true. What a whole *tree*
weighs is the other half: [../../structural/health/overview.md](../../structural/health/overview.md).

| Rule | Blocking | What it buys |
|---|---|---|
| [no-long-comments](no-long-comments.ts) | Yes | No run of comment goes past `maxWords` words or `maxLines` lines, so every comment in the tree is short enough that somebody re-reads it on the edit that invalidates it |

It blocks, and that is the whole of why it is worth having. A warning about comment length is one an
agent writes past on the way to finishing the task, and the comment it wrote outlives the code it
described.

**Use the defaults for no-long-comments** — They're picked with good reason. If you need more than
60 words in a single comment, there is a problem with the code. Most of the time you don't need more
even if you maybe thought you did.
