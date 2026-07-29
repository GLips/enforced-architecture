import { useCallback, useEffect, useState } from "react";

export const Live = ({ id }: { id: string }) => {
  const [rows, setRows] = useState<number[]>([]);

  // An async effect that returns a cleanup: the developer considered the
  // lifecycle, which is all this rule asks of them.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const next = await fetchRows(id);
      if (!cancelled) setRows(next);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // A plainly synchronous effect.
  useEffect(() => {
    document.title = id;
  }, [id]);

  // A synchronous useCallback, which is the ordinary use of the hook.
  const clear = useCallback(() => setRows([]), []);

  return { rows, clear };
};

declare function fetchRows(id: string): Promise<number[]>;
