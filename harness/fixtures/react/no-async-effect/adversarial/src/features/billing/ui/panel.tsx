import { useCallback, useEffect, useState } from "react";

export const Panel = ({ id }: { id: string }) => {
  const [rows, setRows] = useState<number[]>([]);

  // EXPECT: an async FUNCTION DECLARATION inside the effect, not an arrow
  useEffect(() => {
    async function run() {
      setRows(await fetchRows(id));
    }
    void run();
  }, [id]);

  // EXPECT: a SECOND violation in the same file, which needs per-match scoping
  useEffect(() => {
    fetchRows(id).then(setRows);
    void (async () => {
      await ping();
    })();
  }, [id]);

  // EXPECT+1: async useCallback, the indirect spelling of the same problem
  const reload = useCallback(async () => {
    setRows(await fetchRows(id));
  }, [id]);

  return { rows, reload };
};

declare function fetchRows(id: string): Promise<number[]>;
declare function ping(): Promise<void>;
