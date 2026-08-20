// LEGAL: the mirrored pair this check exists to produce. Silent.
//
// `invoices.ts` sits beside it, so one search for the concept surfaces the code
// and the test that constrains it together. A check that reported every test
// file it found would be invisible to the violation fixtures and caught only
// here.
export const invoiceStateCases = ["draft", "sent"];
