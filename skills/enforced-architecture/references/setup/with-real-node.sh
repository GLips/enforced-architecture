#!/usr/bin/env bash
# Copy to `lint/with-real-node.sh`, `chmod +x`, and run BOTH tiers through it:
#   "check:rules"      = "lint/with-real-node.sh --test 'lint/oxlint/**/*.test.ts'"
#   "check:structural" = "lint/with-real-node.sh lint/structural/check-structure.ts"
#
# It sits above both tier directories on purpose. It used to belong to the oxlint
# tier, when only that tier's specs needed real Node; the structural tier needs it
# for a different reason now, and a copy per tier is two copies of one workaround.
#
# Runs its arguments under REAL Node. Two reasons, and the second is the quiet one.
#
# oxlint's RuleTester cannot run under Bun at all. It doesn't parse in JS — it parses in Rust and
# shares the AST through a zero-copy buffer ("raw transfer"). Getting a 2 GiB view aligned to a
# 4 GiB boundary means allocating 6 GiB and carving the aligned slice out of the middle;
# JavaScriptCore can't allocate an ArrayBuffer that large, so oxlint refuses by name and there is
# no slower fallback to opt into.
#
# The structural tier runs under Bun without complaining and gives DIFFERENT ANSWERS. Bun's
# `node:fs` `globSync` walks through symlinked directories and Node's does not — on the catalog's
# own fixture tree the same call returns 282 files under Bun and 275 under Node, and a symlinked
# feature directory enumerated through the link gives every file behind it a second name. The tier
# defends itself against that, but the checks should be RUN on the runtime they are proved on.
#
# Bun puts a `node`-named symlink to ITSELF on PATH (/tmp/bun-node-*/node) for any process it
# spawns, ahead of the real binary. So in a Bun-spawned shell — which is where coding agents run,
# and where `bun run <script>` puts every script — a bare `node` is Bun wearing node's name, and
# both problems above come back silently. Drop those entries so `node` means node.
set -euo pipefail

PATH="$(printf '%s' "$PATH" | tr ':' '\n' | grep -v '/bun-node-' | paste -sd: -)"
export PATH

exec node "$@"
