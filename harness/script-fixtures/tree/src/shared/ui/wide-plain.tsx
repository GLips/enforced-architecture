// FIRES prop-count: eight props, one per line in a named XProps interface —
// the plainest shape that can fire, and the one the doc names.
//
// The other two firing fixtures are both adversarial, written to beat a specific
// matcher. Without an honest case beside them, a check that only ever matched
// the awkward spellings would still pass, and nobody would notice the ordinary
// component going unread.
//
// It sits in `shared/ui` rather than under a feature on purpose. prop-count
// reads three target globs and every other prop-count fixture is under
// `features/*/ui`, so a second glob quietly resolving to nothing would leave
// this file the only thing that says so.
//
// At the threshold rather than past it, so an off-by-one in the comparison
// shows up here too.
interface WidePlainProps {
  title: string;
  subtitle: string;
  tone: string;
  size: string;
  variant: string;
  icon: string;
  dense: boolean;
  onDismiss: () => void;
}

export function WidePlain({
  title,
  subtitle,
  tone,
  size,
  variant,
  icon,
  dense,
  onDismiss,
}: WidePlainProps) {
  return (
    <section data-tone={tone} data-size={size} data-dense={dense}>
      <h2 className={variant} onClick={onDismiss}>
        {icon}
        {title}
      </h2>
      <p>{subtitle}</p>
    </section>
  );
}
