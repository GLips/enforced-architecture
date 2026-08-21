// Server-only, and reachable: nothing above it crosses the boundary.
import postgres from "postgres";

export function postCurtainLedger(): string {
  const driver = String(postgres);
  const stamp = driver.length * 5;
  return `${driver}:${stamp}`;
}
