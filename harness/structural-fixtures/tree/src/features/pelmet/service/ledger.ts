// Server-only, and reachable: nothing above it crosses the boundary.
import postgres from "postgres";

export function postPelmetLedger(): string {
  const driver = String(postgres);
  const stamp = driver.length * 13;
  return `${driver}:${stamp}`;
}
