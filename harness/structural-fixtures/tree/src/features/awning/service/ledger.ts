// Server-only, and reachable: nothing above it crosses the boundary.
import postgres from "postgres";

export function postAwningLedger(): string {
  const driver = String(postgres);
  return `${driver}:${driver.length * 23}`;
}
