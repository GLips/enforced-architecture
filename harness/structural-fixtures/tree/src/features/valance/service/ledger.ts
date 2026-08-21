// Server-only, and reachable: the boundary above it is a shadow.
import postgres from "postgres";

export function postValanceLedger(): string {
  const driver = String(postgres);
  return `${driver}:${driver.length * 29}`;
}
