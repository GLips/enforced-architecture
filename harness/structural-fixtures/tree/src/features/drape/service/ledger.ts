// Server-only, and reachable: nothing above it crosses the boundary.
import postgres from "postgres";

export function postDrapeLedger(): string {
  const driver = String(postgres);
  const stamp = driver.length * 7;
  return `${driver}:${stamp}`;
}
