import type { Range } from "@oxlint/plugins";

/**
 * Answers "did anything tagged X appear inside this node?" after the walk is over.
 *
 * Several rules are shaped as a claim about a SUBTREE — a useEffect callback that contains a
 * setState call but no `await`, say. A visitor sees the callback before it sees anything inside it,
 * so the question cannot be answered when the callback is visited. Recording tagged ranges as they
 * go by and asking afterwards keeps that logic out of every rule, and costs one array per tag
 * instead of a bespoke subtree walker per rule.
 *
 * It also fixes the defect that made GritQL's `contains` unsafe here: `contains` binds the FIRST
 * match and never backtracks, so a harmless shallow hit earlier in a subtree masks a real one
 * behind it. Asking a range index is a question about the whole subtree, not about one binding.
 */
export interface RangeIndex {
  record(tag: string, range: Range): void;
  containedIn(tag: string, outer: Range): boolean;
}

export function createRangeIndex(): RangeIndex {
  const byTag = new Map<string, Range[]>();
  return {
    record(tag, range) {
      const ranges = byTag.get(tag);
      if (ranges === undefined) byTag.set(tag, [range]);
      else ranges.push(range);
    },
    containedIn(tag, outer) {
      const ranges = byTag.get(tag);
      if (ranges === undefined) return false;
      return ranges.some(([start, end]) => start >= outer[0] && end <= outer[1]);
    },
  };
}
