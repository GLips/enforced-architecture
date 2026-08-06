import type { ESTree, Visitor } from "@oxlint/plugins";

/**
 * Every place a module specifier can appear: the four static forms plus `import()`. Boundary rules
 * fence on the specifier string, and a fence that misses one form is one `await import()` — or one
 * `export … from` — away from useless, so they all go through here rather than each rule picking
 * the node types it happened to think of.
 *
 * This is the single biggest correctness win of the port. Under GritQL the same coverage needed
 * `or { JsModuleSource() as $source, \`import($source)\` }` pasted into every boundary template,
 * and the templates that forgot the second arm silently ignored dynamic imports.
 */
export function visitModuleSources(
  onSource: (source: ESTree.StringLiteral, specifier: string) => void,
): Visitor {
  return {
    ImportDeclaration(node) {
      onSource(node.source, node.source.value);
    },
    ExportNamedDeclaration(node) {
      if (node.source !== null) onSource(node.source, node.source.value);
    },
    ExportAllDeclaration(node) {
      onSource(node.source, node.source.value);
    },
    ImportExpression(node) {
      // A computed specifier (`import(path)`) has nothing to fence on; only a literal is checkable.
      if (node.source.type === "Literal" && typeof node.source.value === "string") {
        onSource(node.source, node.source.value);
      }
    },
  };
}
