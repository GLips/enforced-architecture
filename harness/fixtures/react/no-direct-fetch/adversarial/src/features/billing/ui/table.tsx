import { useEffect } from "react";

export const Table = ({ id }: { id: string }) => {
  useEffect(() => {
    // EXPECT+1: buried in a callback, with options, rather than at the top level
    void fetch(`/api/invoices/${id}`, { method: "POST", body: "{}" });
  }, [id]);

  // EXPECT+1: a SECOND call in the same file, which needs per-match scoping
  const refresh = () => fetch("/api/invoices");

  // EXPECT+2: no arguments at all, where a pattern requiring one would miss
  const ping = () =>
    fetch();

  return { refresh, ping };
};
