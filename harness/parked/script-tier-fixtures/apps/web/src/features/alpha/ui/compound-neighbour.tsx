// LEGAL: a genuine compound component. Silent.
//
// BOTH halves are exported, so the check counts two components here and the
// only thing keeping it quiet is the Object.assign exemption. That matters: an
// earlier version of this fixture exported neither part, so the file scored
// zero components and stayed silent whether the exemption existed or not — it
// passed for the wrong reason, and deleting the exemption did not fail the
// suite. A legal fixture has to be one the check would otherwise report.
//
// This is the escape hatch the rule's own message recommends, so if it stopped
// working the rule would be telling people to do something that fails.
export function CardRoot({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}

export function CardHeader({ title }: { title: string }) {
  return <h3>{title}</h3>;
}

export const Card = Object.assign(CardRoot, { Header: CardHeader });
