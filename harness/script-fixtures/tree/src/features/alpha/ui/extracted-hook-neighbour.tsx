// LEGAL: eight hook calls in the file, seven of them inside a custom hook that
// consolidates them. Silent.
//
// This is the shape the rule is asking for, so reporting it says the extraction
// was pointless and is the fastest way to teach people the warning is noise.
// Only a per-COMPONENT count stays quiet here: counting per file sees eight, and
// a declaration matcher keyed on the name rather than the case sees `usePanel`
// as a component and reports the fix as the defect.
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

export function usePanelState(id: string) {
  const [name, setName] = useState(id);
  const [open, setOpen] = useState(false);
  const [count, bump] = useReducer((n: number) => n + 1, 0);
  const node = useRef(null);
  const label = useMemo(() => name, [name]);
  const onToggle = useCallback(() => setOpen((was) => !was), []);
  useEffect(() => setName(id), [id]);

  return { count, bump, label, node, onToggle, open };
}

export function ExtractedHookPanel({ id }: { id: string }) {
  const { count, bump, label, node, onToggle, open } = usePanelState(id);

  return (
    <div ref={node} data-count={count} onClick={onToggle}>
      <button type="button" onClick={bump}>
        {open ? label : id}
      </button>
    </div>
  );
}
