// ─── structure/no-raw-result ─────────────────────────────────────────────
//
// Tag:      structure
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: Data-access functions returning unserializable ORM result
//           objects. Drizzle (and most SQL drivers) return a raw driver
//           Result from write operations (delete, insert, update) when
//           .returning() is not chained. This Result contains functions,
//           internal parser state, and class instances that cannot be
//           serialized by RPC layers (TanStack Start's seroval, tRPC,
//           etc.). When a server function implicitly returns one of
//           these — especially via arrow-expression handlers — the
//           serializer throws at runtime with a cryptic
//           "SerovalUnsupportedTypeError".
//
//           The fix at the source: data-access functions that perform
//           writes without .returning() should use `await` without
//           `return`, so they resolve to `void` instead of leaking a
//           driver-internal object up the call chain.
//
// Applies:  Data-access layers that run Drizzle queries — typically
//           features/*/repo/ and features/*/controllers/ (controllers
//           can call db directly when no repo/ layer exists).
//           Excludes test files and scripts.
//
// Error:    "Returning a Drizzle write without .returning() produces an
//            unserializable postgres Result object. Either add
//            .returning() to get row data, or await without returning."
//
// Negative space: The rule reads the RETURNED CHAIN, not the whole returned
//                 subtree. A write handed to a helper
//                 (`return serialize(db.delete(t))`) is not reported here —
//                 the helper's own return is where the Result would escape.
//                 That is deliberate: asking "does this subtree contain a
//                 write?" reports `return () => db.delete(t)`, which returns
//                 a function, and treats a `.returning()` on an unrelated
//                 subquery as if it sanitized the outer chain.
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. Layer scope (who runs Drizzle queries) — `DATA_ACCESS_LAYERS`:
//    Every layer in the project that performs direct Drizzle queries. If
//    only repo/ touches the DB, drop the controllers/ pattern.
//    The patterns are anchored on /src/ and on both slashes around the
//    layer name, so a sibling directory that merely ends in the same word
//    (`legacy-repo/`) is not mistaken for the layer.
//
// 2. The ORM client binding — `DB_CLIENT`:
//    The identifier a write chain bottoms out in. Change it if the project
//    binds the Drizzle client under another name.
//
// 3. Writes that produce a raw Result — `UNSERIALIZABLE_WRITE_METHODS`
//    and `UNSERIALIZABLE_CHAIN_METHODS`:
//    The first are methods on the client that start a write
//    (delete/insert/update); the second are methods that mark a chain as a
//    write wherever it started, for writes assembled by a query builder
//    rather than from `db` directly. Extend either if the project uses more
//    write spellings.
//
// 4. The escape hatch — `SERIALIZING_METHOD`:
//    .returning() in the chain means the query resolves to plain row
//    objects instead of a driver Result, so the chain is never reported.
//
// 5. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "no-raw-result": noRawResultRule }`) and turn it on in
//    `.oxlintrc.json` (`"<plugin>/no-raw-result": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

const DATA_ACCESS_LAYERS = [
  /\/src\/features\/[^/]+\/repo\//,
  /\/src\/features\/[^/]+\/controllers\//,
];

const DB_CLIENT = "db";
const UNSERIALIZABLE_WRITE_METHODS = new Set(["delete", "insert", "update"]);
const UNSERIALIZABLE_CHAIN_METHODS = new Set(["onConflictDoNothing", "onConflictDoUpdate"]);
const SERIALIZING_METHOD = "returning";

/** Strips the wrappers that sit between a `return` and the chain it returns. */
function unwrapReturnedExpression(expression: ESTree.Expression): ESTree.Expression {
  let cursor = expression;
  while (
    cursor.type === "AwaitExpression" ||
    cursor.type === "TSAsExpression" ||
    cursor.type === "TSSatisfiesExpression" ||
    cursor.type === "TSNonNullExpression" ||
    cursor.type === "TSTypeAssertion"
  ) {
    cursor = cursor.type === "AwaitExpression" ? cursor.argument : cursor.expression;
  }
  return cursor;
}

/** The method names called along this chain, plus the identifier it bottoms out in. */
function readQueryChain(call: ESTree.CallExpression): {
  client: string | null;
  methods: string[];
} {
  const methods: string[] = [];
  let cursor: ESTree.Node = call;

  while (cursor.type === "CallExpression") {
    // Annotated rather than destructured: `cursor` is reassigned from this value, and TypeScript
    // reads the inferred pair as circular.
    const callee: ESTree.Expression = cursor.callee;
    if (callee.type !== "MemberExpression" || callee.computed) break;
    if (callee.property.type !== "Identifier") break;
    methods.push(callee.property.name);
    cursor = callee.object;
  }
  return { client: cursor.type === "Identifier" ? cursor.name : null, methods };
}

function leaksRawWriteResult(expression: ESTree.Expression): boolean {
  const returned = unwrapReturnedExpression(expression);

  // Both branches, because either one is what the function resolves to. GritQL's `contains` bound
  // the FIRST match and never backtracked, so a safe branch here masked the write behind it.
  if (returned.type === "ConditionalExpression") {
    return (
      leaksRawWriteResult(returned.consequent) || leaksRawWriteResult(returned.alternate)
    );
  }
  if (returned.type !== "CallExpression") return false;

  const { client, methods } = readQueryChain(returned);
  if (methods.includes(SERIALIZING_METHOD)) return false;
  if (methods.some((method) => UNSERIALIZABLE_CHAIN_METHODS.has(method))) return true;
  return (
    client === DB_CLIENT && methods.some((method) => UNSERIALIZABLE_WRITE_METHODS.has(method))
  );
}

export const noRawResultRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      rawWriteReturned:
        "Returning a Drizzle write without .returning() produces an unserializable postgres Result object. Either add .returning() or await without returning.",
      rawWriteExpressionBody:
        "An expression-bodied function returns an unserializable Drizzle write result. Add .returning() or use a block body and await without returning.",
    },
  },
  create(context) {
    const { filename } = context;
    if (isArchitectureExemptPath(filename)) return {};
    if (!DATA_ACCESS_LAYERS.some((layer) => layer.test(filename))) return {};

    return {
      ReturnStatement(node) {
        if (node.argument === null) return;
        if (leaksRawWriteResult(node.argument)) {
          context.report({ node, messageId: "rawWriteReturned" });
        }
      },
      ArrowFunctionExpression(node) {
        // A block body returns nothing implicitly; its `return` statements are caught above.
        if (node.body.type === "BlockStatement") return;
        if (leaksRawWriteResult(node.body)) {
          context.report({ node, messageId: "rawWriteExpressionBody" });
        }
      },
    };
  },
});
