// FIRES prop-count: nine props declared as a named XProps interface, which is
// the other counting strategy and has its own way of going quiet.
//
// Six of the nine members are arrow-typed. An arrow ends in `>`, and a depth
// counter that treats that as a closing bracket drops below zero at the first
// one and stops splitting on the separators after it — the remaining members
// merge into one token and the component scores 3 instead of 9, under the
// threshold, silent. Only a fixture with arrows ABOVE the threshold and enough
// of them to matter catches that.
interface WideTypedProps {
  rowId: string;
  onOpen: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onArchive: () => void;
  onRestore: () => void;
  render: () => JSX.Element;
  columns: Map<string, number>;
  dense?: boolean;
}

export function WideTyped(props: WideTypedProps) {
  return (
    <div data-dense={props.dense} data-columns={props.columns.size}>
      <button type="button" onClick={() => props.onOpen(props.rowId)}>
        open
      </button>
      <button type="button" onClick={() => props.onClose(props.rowId)}>
        close
      </button>
      <button type="button" onClick={() => props.onRename(props.rowId, "next")}>
        rename
      </button>
      <button type="button" onClick={props.onArchive}>
        archive
      </button>
      <button type="button" onClick={props.onRestore}>
        restore
      </button>
      {props.render()}
    </div>
  );
}
