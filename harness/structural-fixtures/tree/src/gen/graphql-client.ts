// SILENT in placement/topology: `gen/` is this tree's generatedDir, and
// a generated directory is exempt in BOTH tiers.
//
// It is a top-level directory the path grammar claims nothing about, so without
// the exemption it is an unclassified position and a blocking finding — while
// the linter, which derives its ignore patterns from the same list, said nothing
// about the identical file. One file, two verdicts, and the tier that skipped it
// looked clean.
//
// The file is deliberately NOT named `.gen.ts`: the naming convention is the
// other half of the exemption, and a fixture carrying both proves neither.
export const generatedOperationNames = ["listInvoices", "createInvoice"];

export function generatedOperationCount(): number {
  return generatedOperationNames.length;
}
