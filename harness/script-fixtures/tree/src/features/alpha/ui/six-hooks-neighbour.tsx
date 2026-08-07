// LEGAL: six hooks, one under the threshold of seven. Silent.
//
// One under on purpose: sitting directly below the line is what makes an
// over-count visible. A legal fixture cannot detect under-counting — that pair
// lives in many-hooks.tsx.
import { useCallback, useEffect, useMemo, useState } from "react";

export function SixHooksNeighbour({ id }: { id: string }) {
  const [name, setName] = useState(id);
  const [open, setOpen] = useState(false);
  const label = useMemo(() => name, [name]);
  const onOpen = useCallback(() => setOpen(true), []);
  const onShut = useCallback(() => setOpen(false), []);
  useEffect(() => setName(id), [id]);

  return (
    <button type="button" onClick={open ? onShut : onOpen}>
      {label}
    </button>
  );
}
