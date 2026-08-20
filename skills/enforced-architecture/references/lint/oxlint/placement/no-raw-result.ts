// ─── placement/no-raw-result ─────────────────────────────────────────────
//
// Makes sure: A repo or controller function never returns a Drizzle write
// result without `.returning()`. That result holds functions and driver state,
// and the RPC serializer throws SerovalUnsupportedTypeError on it at run time,
// far from the query that made it. You return a repo function's value from a
// server function, and you do not first run the delete path in a browser to
// learn whether it serializes.
//
// An expression-bodied arrow returns its chain with no `return` keyword, and it
// is the short spelling a person writes for a one-line delete. A rule that
// visits ReturnStatement alone reads none of them.
//
// `onConflictDoNothing` and `onConflictDoUpdate` mark a chain as a write
// wherever that chain starts. Do not require it to bottom out in `db`: a write
// that a query builder assembles then passes.
//
// The rule reads the returned chain and not the whole returned subtree. A write
// handed to a helper (`return serialize(db.delete(t))`) gets no report here,
// because the helper's own return statement returns the write result, not
// the return this rule reads. A subtree test
// reports `return () => db.delete(t)`, which returns a function, and it reads a
// `.returning()` on an unrelated subquery as a fix of the outer chain.
//
// The scope is the layers that run queries, repo/ and controllers/. A db call
// in another layer is boundary/db-isolation's finding.
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { classifyFileRole, isAtProfile } from "../../policy/declared-trees.ts";
import type { SourceProfile } from "../../policy/layout.ts";

/** The layers that run queries. Profiles, so a renamed layer keeps its scope. */
const DATA_ACCESS_PROFILES: SourceProfile[] = ["feature-repo", "feature-controllers"];

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
    const role = classifyFileRole(context.filename);
    if (role === undefined || !isAtProfile(role, ...DATA_ACCESS_PROFILES)) return {};

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
