// FIRES hook-count: seven hooks in shared/ui, the third of hook-count's roots.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function SharedWithManyHooks({ id }: { id: string }) {
  const [name, setName] = useState<string | null>(null);
  const node = useRef<HTMLDivElement>(null);
  const label = useMemo(() => name ?? id, [id, name]);
  useEffect(() => setName(id), [id]);
  const onA = useCallback(() => setName(id), [id]), onB = useCallback(() => setName(null), []);
  const [open, setOpen] = useState(false);
  return <div ref={node} data-open={open} onClick={open ? onB : onA}>{label}</div>;
}
