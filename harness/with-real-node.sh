#!/usr/bin/env bash
# Runs its arguments under REAL Node, which every check in this repo now needs.
#
# Two separate reasons, and the second is the one that is easy to lose.
#
# oxlint's RuleTester cannot run under Bun at all. It doesn't parse in JS — it parses in Rust and
# shares the AST through a zero-copy buffer ("raw transfer"). Getting a 2 GiB view aligned to a
# 4 GiB boundary means allocating 6 GiB and carving the aligned slice out of the middle;
# JavaScriptCore can't allocate an ArrayBuffer that large, so oxlint refuses by name and there is
# no slower fallback to opt into.
#
# The structural tier runs under Bun without complaining, and gives DIFFERENT ANSWERS. Bun's
# `node:fs` `globSync` walks through symlinked directories and Node's does not: the same call over
# this repo's fixture tree returns 282 files under Bun and 275 under Node. The tier defends itself
# against that (see `globWithoutSymlinks` in `check-context.ts`), but a suite that proves the
# checks under one runtime and ships them to another is proving the wrong thing.
#
# Bun puts a `node`-named symlink to ITSELF on PATH (/tmp/bun-node-*/node) for any process it
# spawns, ahead of the real binary. So in a Bun-spawned shell — which is where coding agents run —
# a bare `node` is Bun wearing node's name, and both problems above come back silently. Drop those
# entries so `node` means node.
set -euo pipefail

PATH="$(printf '%s' "$PATH" | tr ':' '\n' | grep -v '/bun-node-' | paste -sd: -)"
export PATH

exec node "$@"
