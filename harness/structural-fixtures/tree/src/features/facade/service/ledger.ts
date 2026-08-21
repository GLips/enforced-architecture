// Server-only, and reachable: nothing above it crosses the boundary.
import postgres from "postgres";

export function postFacadeLedger(): string {
  const driver = String(postgres);
  const stamp = driver.length * 17;
  return `${driver}:${stamp}`;
}
