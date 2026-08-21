// FIRES barrel-purity: the same escape on the DYNAMIC path, which is a different
// reader. A static import's module request arrives cooked from the module
// record; a dynamic one arrives as an AST node whose source text still holds the
// escape. Two readers, two chances to hand the resolver a spelling instead of a
// name, and `escapade` pins only the first.
export const loadCharge = async (): Promise<string> => {
  const { chargeTwice } = await import("./service/charge-twic\u0065.ts");
  return chargeTwice();
};
