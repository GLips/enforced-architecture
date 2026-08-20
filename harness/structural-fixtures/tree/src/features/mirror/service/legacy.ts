// Not a test's sibling — the module the qualifier rule finds when it strips a
// dot that belongs to the DIRECTORY `legacy.v2/` rather than to a filename.
// Its whole job is to exist, so that stripping the wrong dot lands somewhere
// and silently clears the orphan beside it.
export const legacyRateVersion = "v1";
