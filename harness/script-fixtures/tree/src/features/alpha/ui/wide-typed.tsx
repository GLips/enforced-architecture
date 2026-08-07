// FIRES prop-count: nine props declared as a named XProps interface, which is
// the other counting strategy and has two ways of its own to go quiet.
//
// Six of the nine members are arrow-typed. An arrow ends in `>`, and a depth
// counter that treats that as a closing bracket drops below zero at the first
// one and stops splitting on the separators after it — the remaining members
// merge into one token and the component scores 3 instead of 9, under the
// threshold, silent. Only a fixture with arrows ABOVE the threshold and enough
// of them to matter catches that.
//
// The interface also carries a TYPE-PARAMETER LIST, which is the ordinary
// generic spelling and sits between the name and the body. A pattern demanding
// `{` or `=` immediately after `WideTypedProps` never finds the declaration, and
// the check falls through to the destructure strategy — which has nothing to
// count here, because this component takes `props` whole. Silent again.
interface WideTypedProps<Id extends string> {
  rowId: Id;
  onOpen: (id: Id) => void;
  onClose: (id: Id) => void;
  onRename: (id: Id, name: string) => void;
  onArchive: () => void;
  onRestore: () => void;
  render: () => JSX.Element;
  columns: Map<string, number>;
  dense?: boolean;
}

export function WideTyped(props: WideTypedProps<string>) {
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
