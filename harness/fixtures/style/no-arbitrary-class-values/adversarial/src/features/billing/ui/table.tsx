// Each arm gets its own string, because `any` yields one diagnostic per node:
// arms two and three are only reachable when arm one FAILS on that node.

// EXPECT+1: only the var shape, which carries no px, rem or hex at all
export const Var = () => <div className="bg-[var(--background)]" />;

// EXPECT+1: only the framework's generic type scale, with no brackets
export const Scale = () => <div className="text-sm font-medium" />;

// EXPECT: a raw hex in the bracket syntax, single-quoted
export const Cell = () => <div className='bg-[#0a0c10]' />;

// EXPECT+2: buried among legal classes rather than alone in the string
export const Head = () => (
  <div className="flex items-center gap-m rounded-lg border-[2px] p-m" />
);

// All three shapes in one string still report ONCE, not three times: the
// author fixes them across three runs. Splitting the arms into separate plugin
// files is the documented trade for reporting them together.
// EXPECT: three off-token shapes in one string, reported once
export const All = () => <div className="text-[13px] bg-[var(--background)] text-sm" />;
