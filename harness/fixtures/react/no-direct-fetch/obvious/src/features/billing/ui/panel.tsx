export const Panel = async () => {
  // EXPECT+1: a bare fetch in a component file
  const res = await fetch("/api/invoices");
  return res.json();
};
