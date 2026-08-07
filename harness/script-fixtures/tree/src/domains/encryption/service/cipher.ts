// The false marker, and the server-only leaf, in one module.
//
// Marker detection is a string match, so this comment alone is enough to stop a
// trace on a file that defines no server function — a comment, a string literal,
// or an unused import of the name all do it. Nothing here is wrapped in
// createServerFn: domain logic stays pure and is called from a controller.
//
// It sits under service/ rather than at the domain root because
// `structure/topology` holds a subdivided directory's root to index.ts,
// index.server.ts and errors.ts.
import { createHash } from "node:crypto";

export function encryptField(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
