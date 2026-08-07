// The leaf of the aliased chain, and the reason it is a `node:` builtin: a
// bundler resolves a builtin to nothing and the client build dies here, but the
// module reads as an ordinary shared helper from anywhere above it.
import { hostname } from "node:os";

export function hostFingerprint(): string {
  return hostname();
}
