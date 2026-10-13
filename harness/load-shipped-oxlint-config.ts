/**
 * Loads the shipped `setup/oxlint.config.ts` as an adopting project would see it.
 *
 * The file is written to sit at a repo root beside `lint/`, so its
 * `./lint/oxlint/plugin.ts` import does not resolve where the catalog keeps it.
 * This stages it in a temp directory with `lint/` and `node_modules/` linked in,
 * then imports it. Importing runs the config's load-time assertion too, so a
 * plugin rule the config never enables fails here rather than at an adopter.
 */

import { cpSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REFERENCES = join(REPO_ROOT, "skills/enforced-architecture/references");
export const SHIPPED_OXLINT_CONFIG_PATH = join(REFERENCES, "setup/oxlint.config.ts");

export type ShippedOxlintConfig = {
  rules?: Record<string, unknown>;
  ignorePatterns?: string[];
  overrides?: { files?: string[]; excludeFiles?: string[]; rules?: Record<string, unknown> }[];
};

export async function loadShippedOxlintConfig(): Promise<ShippedOxlintConfig> {
  const stage = mkdtempSync(join(tmpdir(), "ea-shipped-oxlint-config-"));
  try {
    cpSync(SHIPPED_OXLINT_CONFIG_PATH, join(stage, "oxlint.config.ts"));
    symlinkSync(join(REFERENCES, "lint"), join(stage, "lint"), "dir");
    symlinkSync(join(REPO_ROOT, "node_modules"), join(stage, "node_modules"), "dir");
    const module = (await import(pathToFileURL(join(stage, "oxlint.config.ts")).href)) as {
      default: ShippedOxlintConfig;
    };
    return module.default;
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}
