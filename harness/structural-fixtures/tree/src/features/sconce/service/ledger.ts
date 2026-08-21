// Server-only, and reachable: nothing above it crosses the boundary.
import postgres from "postgres";

export function postSconceLedger(): string {
  const driver = String(postgres);
  const stamp = driver.length * 11;
  return `${driver}:${stamp}`;
}
