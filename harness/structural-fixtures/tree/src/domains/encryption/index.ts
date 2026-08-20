// FIRES barrel-purity: a DOMAIN barrel over a module that mentions the
// server-function marker.
//
// index.ts → service/cipher.ts → "node:crypto". The short-circuit that makes
// this check usable on features — stop at a module the framework compiles into
// an RPC stub — is wrong here: domains never define server functions, so a
// mention of the marker in a domain module is always a false one. A check that
// applies the short-circuit everywhere goes silent on this barrel while staying
// green on every feature fixture beside it.
export { encryptField } from "./service/cipher.ts";
