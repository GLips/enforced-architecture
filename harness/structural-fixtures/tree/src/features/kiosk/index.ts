// FIRES barrel-discoverability twice, on two shapes no pattern over the source
// text reads — the check's answers come off the parser's export record, and
// these are the two places the record and the text disagree.
//
//   - the wildcard's specifier is spelled with a unicode escape, so the module
//     it names and the bytes between the quotes are two different strings. A
//     matcher that captures the quoted text reports the right line and then
//     quotes a path back at the reader that they cannot open, grep for, or
//     resolve.
//   - the re-exported name is a STRING, which the language has allowed since
//     ES2022 and which an identifier pattern cannot match. It goes unreported
//     entirely, and a barrel renaming every one of its names this way reads as
//     a clean barrel.
//
// The count is the assertion for both: this file reports either way if only one
// of the two branches works.
export * from "./service/kiosk-registr\u0079.ts";
export { "kiosk-open" as openKiosk } from "./service/kiosk-session.ts";
