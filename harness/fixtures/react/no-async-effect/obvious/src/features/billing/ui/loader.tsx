import { useEffect, useState } from "react";

export const Loader = ({ id }: { id: string }) => {
  const [rows, setRows] = useState<number[]>([]);
  // EXPECT: an await in an effect with no cleanup return
  useEffect(() => {
    void (async () => setRows(await fetchRows(id)))();
  }, [id]);
  return rows;
};

declare function fetchRows(id: string): Promise<number[]>;
