# Server and client boundaries

`.server.ts` means the module never reaches the browser bundle. Server functions
stay in plain `.ts` so the framework can compile them into RPC stubs, and the
raw helpers they call sit beside them under the server suffix.

The split is per file, not per directory, because a feature routinely needs both
halves and a directory boundary would force a second feature to exist.
