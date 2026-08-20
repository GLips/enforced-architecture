// Below the boundary, and deliberately server-only. Reachable from the barrel
// only through the server function above it, so it never ships to a client.
import postgres from "postgres";

export function reserveInventory(): string {
  const pool = String(postgres);
  return pool;
}
