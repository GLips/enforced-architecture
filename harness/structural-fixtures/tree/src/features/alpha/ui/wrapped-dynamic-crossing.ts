// FIRES import-policy: a sibling-feature crossing as a dynamic import whose
// specifier the formatter wrapped. Goes quiet if extraction reads one line at a
// time — tk has two live instances of the form (routes/api.locate.ts,
// api.events.ts), both correctly aliased, so nothing would look wrong.
export async function loadBetaThing() {
  const { betaThing } = await import(
    "../../beta/service/beta-thing.ts"
  );
  return betaThing;
}
