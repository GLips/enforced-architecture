import type { Context, ESTree } from "@oxlint/plugins";

/** A diagnostic to be held until the file is walked. `node` is required — it is what gets sorted. */
type OrderedDiagnostic = {
  node: ESTree.Node;
  messageId: string;
  data?: Record<string, string>;
};

/**
 * Holds a rule's diagnostics until `Program:exit` and emits them in source order.
 *
 * oxlint emits diagnostics in the order a rule reports them, and a rule with both traversal-time
 * arms and a whole-file arm reports them in neither source nor any other legible order: everything
 * the whole-file arm finds lands after everything the traversal found, however early in the file it
 * sits. A rule that fences imported names has both by construction — scope analysis answers about
 * the whole file, and the spellings that bind no name are only visible mid-traversal.
 *
 * ONE OWNER. Every arm of a rule that uses this must report through it, including the arms that run
 * during traversal and would be in order on their own. Half a rule buffering is the case that
 * produces the scrambled output above, and it is the shape this module exists to make unwritable.
 *
 * NO FIXTURE CAN PIN THIS, and none can be written: `RuleTester` sorts a rule's diagnostics by span
 * before comparing them, so under the harness the order is correct whether this module runs or not.
 * Delete it and `bun run check` stays green. It is verified against the oxlint CLI by hand — a
 * catalog check that runs the CLI and asserts report order is the missing harness, and is filed
 * rather than faked here.
 *
 * NEGATIVE SPACE: `loc`-only diagnostics are not accepted. Sorting needs a span, and every rule in
 * the catalog blames a node.
 */
export function sourceOrderedReports(context: Context) {
  const pending: OrderedDiagnostic[] = [];

  const flushInSourceOrder = () => {
    pending.sort((left, right) => left.node.range[0] - right.node.range[0]);
    for (const diagnostic of pending) context.report(diagnostic);
    pending.length = 0;
  };

  return {
    report(diagnostic: OrderedDiagnostic) {
      pending.push(diagnostic);
    },

    /**
     * Call this LAST inside the rule's own `Program:exit`, once every arm has had its say.
     *
     * There is deliberately no visitor to spread. A spread `Program:exit` and the rule's own one
     * cannot coexist — whichever comes second in the object literal wins and the other is lost
     * with no error, and it is a coin toss which loss you get: lose the flush and the rule goes
     * silent, lose the other and its whole arm does. Every rule owning the key outright is the
     * only shape where that cannot happen. `visitImportedNames` has no `Program:exit` for the same
     * reason.
     */
    flushInSourceOrder,
  };
}
