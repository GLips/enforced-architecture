// FIRES hook-count: seven hooks in a route module.
//
// hook-count scans three roots — features, shared/ui and routes — and only
// features was exercised. This file and the shared/ui one below it are what
// make the other two roots more than a string in an array.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function RouteWithManyHooks({ id }: { id: string }) {
  const [name, setName] = useState<string | null>(null);
  const node = useRef<HTMLDivElement>(null);
  const label = useMemo(() => name ?? id, [id, name]);
  useEffect(() => setName(id), [id]);
  const onA = useCallback(() => setName(id), [id]), onB = useCallback(() => setName(null), []);
  const [open, setOpen] = useState(false);
  return <div ref={node} data-open={open} onClick={open ? onB : onA}>{label}</div>;
}
