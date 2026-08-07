// FIRES hook-count: seven hooks, reached only if BOTH hooks on the `onOpen`/`onShut`
// line are counted. A matcher that stops after the first hit per line scores six
// and goes silent. At the threshold rather than past it, so an off-by-one in the
// comparison shows up too, and two hooks carry generic type arguments.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function ManyHooks({ id }: { id: string }) {
  const [name, setName] = useState<string | null>(null);
  const node = useRef<HTMLDivElement>(null);
  const label = useMemo(() => `${id}:${name}`, [id, name]);
  useEffect(() => setName(id), [id]);
  const onOpen = useCallback(() => setName(id), [id]), onShut = useCallback(() => setName(null), []);
  const [open, setOpen] = useState(false);

  return (
    <div ref={node} onClick={open ? onShut : onOpen}>
      {label}
      <button type="button" onClick={() => setOpen(true)} />
    </div>
  );
}
