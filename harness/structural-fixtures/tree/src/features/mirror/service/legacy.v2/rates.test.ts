// WARNS test-file-mirror: an orphan test under a directory whose NAME carries a
// dot.
//
// The qualifier rule strips one dotted qualifier before the suffix — but only
// when the dot is in the filename. Taking the last dot of the whole path strips
// `.v2` off the ancestor instead, then looks for a module named
// `legacy/rates`, which exists nowhere, and the orphan below goes unreported
// while the check looks like it is working.
export const legacyRateCases = [1, 2];
