import { useEffect, useState } from "react";

export const Total = ({ items }: { items: number[] }) => {
  const [total, setTotal] = useState(0);
  // EXPECT: state synced from props via an effect, which is the named anti-pattern
  useEffect(() => {
    setTotal(items.reduce((a, b) => a + b, 0));
  }, [items]);
  return total;
};
