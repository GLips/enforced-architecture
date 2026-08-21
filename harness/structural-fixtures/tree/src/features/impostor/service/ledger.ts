// Server-only, and NOT below a real boundary — so this chain reaches the client
// bundle and the barrel above it has to report.
import postgres from "postgres";

export function postLedger(): string {
  const driver = String(postgres);
  const stamp = driver.length * 2;
  return `${driver}:${stamp}`;
}
