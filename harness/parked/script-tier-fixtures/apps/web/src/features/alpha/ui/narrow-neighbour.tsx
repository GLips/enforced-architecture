// LEGAL: seven props, under the threshold of eight, and it must stay silent.
//
// It sits one prop under on purpose. The inline type literal repeats every name
// with comma separators, so an implementation that reads the counted region to
// the LAST brace in the signature rather than the destructure's own closing
// brace scores this at fourteen and reports it. Being close to the threshold is
// what makes that visible — a three-prop legal fixture stays silent even when
// double-counted, and proves nothing.
//
// `children` and `...rest` are excluded by policy: children is a structural
// convention and rest is explicit forwarding, not a consumed prop.
//
// Over-counting is invisible to every positive fixture, and it is the failure
// that costs most: a check that warns about a seven-prop component is a check
// people learn to scroll past.
export function NarrowNeighbour({
  title,
  onDismiss,
  tone,
  size,
  variant,
  icon,
  dense,
  children,
  ...rest
}: {
  title: string,
  onDismiss: () => void,
  tone: "info" | "warn",
  size: "sm" | "md",
  variant: string,
  icon: string,
  dense: boolean,
  children: React.ReactNode,
}) {
  return (
    <section {...rest} data-tone={tone} data-size={size} data-dense={dense}>
      <h2 onClick={onDismiss} className={variant}>
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}
