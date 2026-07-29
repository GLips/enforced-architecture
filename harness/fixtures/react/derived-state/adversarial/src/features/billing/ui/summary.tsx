import { useEffect, useState } from "react";

export const Summary = ({ items, rate }: { items: number[]; rate: number }) => {
  const [total, setTotal] = useState(0);
  const [tax, setTax] = useState(0);

  // EXPECT: the setter sits inside a nested helper, not at the effect's top level
  useEffect(() => {
    const recompute = () => setTotal(items.reduce((a, b) => a + b, 0));
    recompute();
  }, [items]);

  // EXPECT: a SECOND violation in the same file, which needs per-match scoping
  useEffect(() => {
    setTax(items.length * rate);
  }, [items, rate]);

  // EXPECT: the updater-function form, where the argument is a callback
  useEffect(
    () => {
      setTotal((prev) => prev + rate);
    },
    [rate],
  );

  return total + tax;
};
