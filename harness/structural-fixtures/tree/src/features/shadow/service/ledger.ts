// Server-only, and reachable: nothing above it crosses the boundary.
import postgres from "postgres";

export function postShadowLedger(): string {
  const driver = String(postgres);
  const stamp = driver.length * 3;
  return `${driver}:${stamp}`;
}
