// FIRES prop-count: eight props, six of them behind an `extends` clause.
//
// The interface half of `wide-intersection.tsx`'s blind spot. The members the
// component adds sit between the braces where a brace-to-brace reader expects
// them; the other six sit in the heritage clause, which that reader never
// visits. Two counted instead of eight, under the threshold, silent.
//
// The clause names TWO bases on purpose. `extends A, B` is a comma list, and a
// fix that resolves "the base" rather than every name in the list reads five
// props here — still under the line, still silent, and passing the intersection
// fixture the whole time.
interface WideExtendsIdentity {
  rowId: string;
  label: string;
  tone: "info" | "warn";
}

interface WideExtendsLayout {
  columns: number;
  dense: boolean;
  gutter: number;
}

interface WideExtendsProps extends WideExtendsIdentity, WideExtendsLayout {
  onOpen: (id: string) => void;
  onClose: (id: string) => void;
}

export function WideExtends(props: WideExtendsProps) {
  return (
    <div data-tone={props.tone} data-dense={props.dense} data-gutter={props.gutter}>
      <span data-columns={props.columns}>{props.label}</span>
      <button type="button" onClick={() => props.onOpen(props.rowId)}>
        open
      </button>
      <button type="button" onClick={() => props.onClose(props.rowId)}>
        close
      </button>
    </div>
  );
}
