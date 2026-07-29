import { useCallback, useEffect, useMemo, useState } from "react";

export const Live = ({ items, id }: { items: number[]; id: string }) => {
  const [rows, setRows] = useState<number[]>([]);

  // The refactor the rule asks for: compute it, do not sync it.
  const total = useMemo(() => items.reduce((a, b) => a + b, 0), [items]);

  // An effect that awaits external data is event accumulation, not derived
  // state, and the rule exempts it deliberately.
  useEffect(() => {
    const load = async () => {
      const next = await fetchRows(id);
      setRows(next);
    };
    void load();
  }, [id]);

  // A setter in an event handler is the ordinary way to use useState.
  const onClick = useCallback(() => setRows([]), []);

  // An effect that calls something which merely starts with "set" in lower
  // case, and one that calls no setter at all.
  useEffect(() => {
    settle(id);
    console.log(total);
  }, [id, total]);

  return { rows, total, onClick };
};

declare function fetchRows(id: string): Promise<number[]>;
declare function settle(id: string): void;
