#!/usr/bin/env bash
# Runs its arguments under REAL Node, which oxlint's RuleTester requires.
#
# RuleTester doesn't parse in JS — it parses in Rust and shares the AST through a zero-copy buffer
# ("raw transfer"). Getting a 2 GiB view aligned to a 4 GiB boundary means allocating 6 GiB and
# carving the aligned slice out of the middle; JavaScriptCore can't allocate an ArrayBuffer that
# large, so oxlint refuses to run under Bun by name and there is no slower fallback to opt into.
#
# Bun puts a `node`-named symlink to ITSELF on PATH (/tmp/bun-node-*/node) for any process it
# spawns, ahead of the real binary. So in a Bun-spawned shell — which is where coding agents run —
# a bare `node` is Bun wearing node's name, and every spec dies with a misleading
# "Cannot use describe outside of the test runner". Drop those entries so `node` means node.
set -euo pipefail

PATH="$(printf '%s' "$PATH" | tr ':' '\n' | grep -v '/bun-node-' | paste -sd: -)"
export PATH

exec node "$@"
