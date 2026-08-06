// ─── boundary/env-access ─────────────────────────────────────────────
//
// Tag:      boundary
// Mechanism: oxlint JS plugin (per-file, real-time)
// Blocking: Yes
//
// Prevents: Any module other than the env module reading process.env
//           (or import.meta.env) directly.
//
// Applies:  All src/** files EXCEPT the env module itself and tests.
//
// Error:    "Only the env module reads environment variables. Import its
//            validated config and add the variable there."
//
// ── Adapt ─────────────────────────────────────────────────────────────
//
// 1. The owning module — `ENV_MODULE`. One file, named exactly.
//    Projects that split client and server env name both:
//      /\/src\/env\.(?:client|server)\.[tj]s$/
//
// 2. The access forms — `ENV_PROPERTY`, `PROCESS_GLOBAL`,
//    `PROCESS_HOSTS`, `NODE_PROCESS_SPECIFIER`. Between them these cover
//    `process.env`, `process["env"]`, `globalThis.process.env`,
//    `const { env } = process`, `import.meta.env`, and
//    `import { env } from "node:process"`. A project on Vite alone can
//    drop the process arms; a project on Node alone can drop the
//    `import.meta` arm. Do not drop the computed and destructured forms:
//    they are what someone reaches for once the plain read is stopped.
//
// 3. Build-time config files (vite.config.ts, app.config.ts,
//    next.config.js) sit outside src/ and are unaffected. That is
//    deliberate: what the BUILD reads is a different question from what
//    a RUNNING app believes, and conflating them forces an exemption
//    that then gets reused for runtime code.
//
// 4. Registration:
//    Add the rule to the project's oxlint plugin
//    (`rules: { "env-access": envAccessRule }`) and turn it on in
//    `.oxlintrc.json` (`"<plugin>/env-access": "error"`).
//
// ──────────────────────────────────────────────────────────────────────

import { defineRule, type ESTree } from "@oxlint/plugins";
import { isArchitectureExemptPath } from "../lib/architecture-exempt-paths.ts";

const ENV_MODULE = /\/src\/env\.[tj]s$/;
const ENV_PROPERTY = "env";
const PROCESS_GLOBAL = "process";
// `process` is also reachable as a property of the global object, which is a different node shape.
const PROCESS_HOSTS = new Set(["globalThis", "global", "window", "self"]);
const NODE_PROCESS_SPECIFIER = /^(?:node:)?process$/;

/**
 * The name a member expression or object-pattern property reads, whichever way it is spelled.
 *
 * `process.env` and `process["env"]` are the same read and different nodes, and the computed form
 * is the one a linted codebase drifts toward. Resolving both through one helper is what keeps the
 * two spellings from needing two arms in every caller below.
 */
function staticKeyName(key: ESTree.Node, computed: boolean): string | undefined {
  if (!computed) return key.type === "Identifier" ? key.name : undefined;
  return key.type === "Literal" && typeof key.value === "string" ? key.value : undefined;
}

function isProcessReference(node: ESTree.Node): boolean {
  if (node.type === "Identifier") return node.name === PROCESS_GLOBAL;
  if (node.type !== "MemberExpression") return false;
  return (
    node.object.type === "Identifier" &&
    PROCESS_HOSTS.has(node.object.name) &&
    staticKeyName(node.property, node.computed) === PROCESS_GLOBAL
  );
}

/** `import.meta`, as distinct from the other MetaProperty in the language, `new.target`. */
function isImportMeta(node: ESTree.Node): boolean {
  return node.type === "MetaProperty" && node.meta.name === "import";
}

export const envAccessRule = defineRule({
  meta: {
    type: "problem",
    messages: {
      envOutsideEnvModule:
        "Only the env module reads environment variables. Import its validated config and add the variable there.",
    },
  },
  create(context) {
    const { filename } = context;
    if (!filename.includes("/src/")) return {};
    if (ENV_MODULE.test(filename) || isArchitectureExemptPath(filename)) return {};

    return {
      MemberExpression(node) {
        if (staticKeyName(node.property, node.computed) !== ENV_PROPERTY) return;
        if (isProcessReference(node.object) || isImportMeta(node.object)) {
          context.report({ node, messageId: "envOutsideEnvModule" });
        }
      },

      // `const { env } = process` reads the same object without ever writing `process.env`, and
      // `const { env: cfg } = process` hides even the name — so this arm keys on the property, not
      // on the binding it introduces.
      VariableDeclarator(node) {
        if (node.id.type !== "ObjectPattern" || node.init === null) return;
        if (!isProcessReference(node.init) && !isImportMeta(node.init)) return;
        for (const property of node.id.properties) {
          if (property.type !== "Property") continue;
          if (staticKeyName(property.key, property.computed) === ENV_PROPERTY) {
            context.report({ node: property, messageId: "envOutsideEnvModule" });
          }
        }
      },

      // Importing the binding sidesteps every global-shaped check above.
      ImportDeclaration(node) {
        if (!NODE_PROCESS_SPECIFIER.test(node.source.value)) return;
        for (const specifier of node.specifiers) {
          if (specifier.type !== "ImportSpecifier") continue;
          const imported = specifier.imported;
          const name = imported.type === "Identifier" ? imported.name : imported.value;
          if (name === ENV_PROPERTY) {
            context.report({ node: specifier, messageId: "envOutsideEnvModule" });
          }
        }
      },
    };
  },
});
