// FIRES hook-count: eight hooks, one per line, none of them annotated — the
// violation exactly as the doc describes it, so a check that reports nothing
// here is broken outright rather than blind to a spelling.
//
// The adversarial pair (many-hooks.tsx) sits at the threshold and depends on two
// hooks sharing a line; this one stays past the threshold on the plainest
// possible reading, so a regression in the matcher and a regression in the
// comparison can be told apart.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

export function StackedHooks({ id }: { id: string }) {
  const [name, setName] = useState(id);
  const [open, setOpen] = useState(false);
  const [count, bump] = useReducer((n: number) => n + 1, 0);
  const node = useRef(null);
  const label = useMemo(() => name, [name]);
  const onOpen = useCallback(() => setOpen(true), []);
  const onShut = useCallback(() => setOpen(false), []);
  useEffect(() => setName(id), [id]);

  return (
    <div ref={node} data-count={count} onClick={open ? onShut : onOpen}>
      <button type="button" onClick={bump}>
        {label}
      </button>
    </div>
  );
}
