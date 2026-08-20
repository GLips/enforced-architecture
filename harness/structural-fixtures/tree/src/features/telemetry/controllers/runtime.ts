// The aliased hop. Written as `@/…` because it leaves the feature, which is what
// `boundary/import-policy` demands of every crossing.
import { hostFingerprint } from "@/shared/lib/host-fingerprint.ts";

export function describeRuntime(): string {
  return `runtime:${hostFingerprint()}`;
}
