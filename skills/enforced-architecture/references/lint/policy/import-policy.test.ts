// ─── The policy engine's own cases ────────────────────────────────────
//
// `lint/oxlint/boundary/import-policy.test.ts` proves the oxlint RULE, and the
// structural fixture tree proves the structural check. This proves the ENGINE
// both of them read, and it is deliberately not a case per cell.
//
// Generating one case per cell from the table the evaluator reads asserts
// `table === table`: it passes for any table, including a wrong one, and it goes
// red on every deliberate policy change while catching none of the bugs this
// module was built after. Every one of those was a CLASSIFICATION or MATCHING
// bug — `shared` and `shared-ui` disagreeing about a module, a rule banning a
// spelling rather than a dependency, a deep-import pattern needing a segment past
// the feature name so bare barrels escaped, regexes over-matching `ui-kit` and
// `features-legacy`. None was a lookup bug.
//
// So the generated coverage sits on classification: real repo paths and real
// specifiers, each stating which profile, which area, and therefore WHICH CELL it
// reaches. The cell's contents are the table's business; that a path arrives at
// the intended cell is this suite's.
//
// The hand-written half below it is the adapter contract — what stops the
// two-caller design from being a proof in prose.
//
// This file runs under real Node, with the oxlint tier's specs, because that is
// the harness that already has a Node runner. It imports `node:test`, which the
// neutrality contract in `overview.md` forbids the modules beside it: the
// contract governs what SHIPS into both runtimes, and a spec ships into neither.
//
// ──────────────────────────────────────────────────────────────────────

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateImportPolicy,
  IMPORT_POLICY,
  type PolicyVerdict,
  type ImportSurface,
} from "./import-policy.ts";
import {
  classifySourcePath,
  classifyTargetPath,
  classifySpecifier,
  type SourceProfile,
  sourcePathFromFilename,
  type TargetArea,
} from "./layout.ts";

// node:test's `describe` and `it` hand back the suite's promise, and the runner
// owns and awaits the suite it created. Discarding the handle is correct rather
// than merely convenient — a project linting this file with
// `typescript/no-floating-promises` is right to reject the bare call.
function describeSuite(name: string, body: () => void): void {
  void describe(name, body);
}
function testCase(name: string, body: () => void): void {
  void it(name, body);
}

/**
 * One row per (position, destination) pair worth pinning. `from` and `specifier`
 * are spelled the way `directory-model.md` spells them; `profile`, `area` and
 * `surface` are what the author intends them to reach.
 *
 * `surface` is compared against `IMPORT_POLICY[profile][area]`, so a row failing
 * means classification landed on a different cell than intended — never that the
 * cell holds something other than the table says.
 */
type Row = {
  name: string;
  from: string;
  specifier: string;
  profile: SourceProfile;
  area: TargetArea;
  surface: ImportSurface;
};

const CLASSIFICATION: Row[] = [
  // ── the recommended layout, edge by edge ──
  {
    name: "a route composing the feature it renders",
    from: "routes/_authed/invoices.tsx",
    specifier: "@/features/billing",
    profile: "route",
    area: "feature",
    surface: "barrel-or-ui-subtree",
  },
  {
    name: "a route deep-importing the one directory it may, however deep the route sits",
    from: "routes/_authed/settings/billing.tsx",
    specifier: "@/features/billing/ui/InvoiceTable",
    profile: "route",
    area: "feature",
    surface: "barrel-or-ui-subtree",
  },
  {
    name: "a feature barrel re-exporting its own controller",
    from: "features/billing/index.ts",
    specifier: "@/features/billing/controllers/invoices",
    profile: "feature-barrel",
    area: "feature",
    surface: "deny",
  },
  {
    name: "the server barrel is a barrel, not a deep import",
    from: "features/orders/controllers/place.ts",
    specifier: "@/features/billing/index.server",
    profile: "feature-controllers",
    area: "feature",
    surface: "barrel",
  },
  {
    name: "a feature's errors.ts is at the root and is not the barrel",
    from: "features/billing/errors.ts",
    specifier: "@/domains/pricing",
    profile: "feature-root",
    area: "domain",
    surface: "barrel",
  },
  {
    name: "feature UI reaching another feature",
    from: "features/billing/ui/InvoiceTable.tsx",
    specifier: "@/features/orders",
    profile: "feature-ui",
    area: "feature",
    surface: "barrel",
  },
  {
    name: "feature UI taking a primitive",
    from: "features/billing/ui/InvoiceTable.tsx",
    specifier: "@/shared/ui/Button",
    profile: "feature-ui",
    area: "shared-ui",
    surface: "any",
  },
  {
    name: "a controller reading the server env, which is the layer that may",
    from: "features/billing/controllers/invoices.ts",
    specifier: "@/env.server",
    profile: "feature-controllers",
    area: "env-server",
    surface: "any",
  },
  {
    name: "a service is the layer that takes nothing from the outside",
    from: "features/billing/service/invoice-summary.ts",
    specifier: "@/infrastructure/db/client",
    profile: "feature-service",
    area: "infrastructure",
    surface: "deny",
  },
  {
    name: "a repo nested one directory deeper is still the repo layer",
    from: "features/billing/repo/wire/invoice-rows.ts",
    specifier: "drizzle-orm",
    profile: "feature-repo",
    area: "package",
    surface: "any",
  },
  {
    name: "a domain barrel is the domain profile — domains have no separate barrel row",
    from: "domains/pricing/index.ts",
    specifier: "@/shared/utils",
    profile: "domain",
    area: "shared",
    surface: "any",
  },
  {
    name: "an adapter may not reach up into a feature",
    from: "infrastructure/telemetry/sentry.ts",
    specifier: "@/features/billing",
    profile: "infrastructure",
    area: "feature",
    surface: "deny",
  },
  {
    name: "a shared helper reading another shared helper",
    from: "shared/utils.ts",
    specifier: "@/shared/format-currency",
    profile: "shared",
    area: "shared",
    surface: "any",
  },
  {
    name: "a primitive reading a shared helper, an edge that is one boundary and two units",
    from: "shared/ui/Button.tsx",
    specifier: "@/shared/utils",
    profile: "shared-ui",
    area: "shared",
    surface: "any",
  },
  {
    name: "a primitive taking a package",
    from: "shared/ui/Text.tsx",
    specifier: "react",
    profile: "shared-ui",
    area: "package",
    surface: "any",
  },
  {
    name: "the router is a file in the source root, and the route tree it names is a route",
    from: "router.tsx",
    specifier: "@/routes/__root",
    profile: "source-root",
    area: "route",
    surface: "any",
  },
  {
    name: "the env modules are two destinations with one row between them as sources",
    from: "env.server.ts",
    specifier: "zod",
    profile: "source-root",
    area: "package",
    surface: "any",
  },

  // ── the adversarial neighbours that beat a naive matcher ──
  {
    name: "ui/ is a segment, so a sibling ui-kit/ is not the primitives layer",
    from: "shared/ui-kit/Card.tsx",
    specifier: "@/features/billing",
    profile: "shared",
    area: "feature",
    surface: "deny",
  },
  {
    name: "a directory whose name merely starts like the primitives is a different area",
    from: "features/billing/ui/Panel.tsx",
    specifier: "@/shared/uikit/card",
    profile: "feature-ui",
    area: "shared",
    surface: "any",
  },
  {
    name: "a scoped package starts with @ and is not the alias",
    from: "features/billing/controllers/invoices.ts",
    specifier: "@tanstack/react-query",
    profile: "feature-controllers",
    area: "package",
    surface: "any",
  },
  {
    name: "a package subpath belongs to the package it is a subpath of",
    from: "features/billing/repo/invoice-rows.ts",
    specifier: "drizzle-orm/pg-core",
    profile: "feature-repo",
    area: "package",
    surface: "any",
  },
  {
    name: "a bare feature barrel has no segment past the feature name to match on",
    from: "infrastructure/db/client.ts",
    specifier: "@/features/billing",
    profile: "infrastructure",
    area: "feature",
    surface: "deny",
  },
  {
    // The cell is permissive because the row grants the whole adapter layer; what
    // stops this edge is the runtime-purity flag ahead of the table. The row is
    // here for the AREA: spelled naively it reads as the domain's own subtree.
    name: "a .. segment inside an alias lands where it resolves, not where it is spelled",
    from: "domains/pricing/rate-card.ts",
    specifier: "@/domains/pricing/../../infrastructure/db",
    profile: "domain",
    area: "infrastructure",
    surface: "deny",
  },
  {
    name: "a top-level unit named bare is that unit's own barrel",
    from: "features/billing/ui/InvoiceTable.tsx",
    specifier: "@/shared",
    profile: "feature-ui",
    area: "shared",
    surface: "any",
  },
  {
    name: "the client env and the server env are two areas, one segment apart",
    from: "shared/utils.ts",
    specifier: "@/env.client",
    profile: "shared",
    area: "env-client",
    surface: "any",
  },
];

describeSuite("classification: every path lands on the cell its author intended", () => {
  for (const row of CLASSIFICATION) {
    testCase(row.name, () => {
      const from = classifySourcePath(row.from);
      assert.notEqual(from, undefined, `${row.from} classified as nothing`);
      assert.equal(from?.profile, row.profile);

      const read = classifySpecifier(row.specifier);
      assert.notEqual(read, undefined, `${row.specifier} read as nothing`);

      const area =
        read?.kind === "package"
          ? ("package" as TargetArea)
          : classifyTargetPath(read?.path ?? "")?.area;
      assert.equal(area, row.area);

      assert.deepEqual(IMPORT_POLICY[row.profile][row.area], row.surface);
    });
  }
});

describeSuite("classification: what is deliberately not classified", () => {
  testCase("a top-level directory nobody declared is unclassified, not silently exempt", () => {
    assert.equal(classifySourcePath("lib/format-date.ts"), undefined);
    assert.equal(classifyTargetPath("lib/format-date"), undefined);
  });

  testCase("a directory inside a feature that is not a layer is unclassified", () => {
    assert.equal(classifySourcePath("features/billing/helpers/format.ts"), undefined);
  });

  testCase("a file at a feature root IS classified, so topology reports it alone", () => {
    // `placement/topology` rejects a root file that is not on its list. Leaving
    // it unclassified here would report one mistake twice, with two fixes named.
    assert.equal(classifySourcePath("features/billing/constants.ts")?.profile, "feature-root");
  });

  testCase("the bare subdivided directories name no unit at all", () => {
    assert.equal(classifyTargetPath("features"), undefined);
    assert.equal(classifyTargetPath("domains"), undefined);
  });

  testCase("an asset and a relative path are not this tier's question", () => {
    assert.equal(classifySpecifier("../styles.css"), undefined);
    assert.equal(classifySpecifier("./InvoiceTable"), undefined);
    assert.equal(classifySpecifier("@/styles.css?url"), undefined);
  });

  testCase("a filename outside any source root yields no path to classify", () => {
    assert.equal(sourcePathFromFilename("/repo/lint/structural/registry.ts"), undefined);
    assert.equal(sourcePathFromFilename("/repo/src/shared/ui/Button.tsx"), "shared/ui/Button.tsx");
  });
});

/** The evaluator, in the shape the OXLINT adapter calls it: a specifier. */
function verdict(
  from: string,
  specifier: string,
  options: { typeOnly?: boolean } = {},
): PolicyVerdict {
  const read = classifySpecifier(specifier);
  assert.notEqual(read, undefined, `${specifier} is not a specifier this helper can read`);
  return evaluateImportPolicy({
    sourcePath: from,
    target: read as { kind: "module"; path: string } | { kind: "package"; name: string },
    specifier,
    typeOnly: options.typeOnly === true,
  });
}

/** The evaluator as the STRUCTURAL adapter calls it: a resolved path, not a specifier. */
function resolvedVerdict(
  from: string,
  specifier: string,
  target: string,
  options: { typeOnly?: boolean } = {},
): PolicyVerdict {
  return evaluateImportPolicy({
    sourcePath: from,
    target: { kind: "module", path: target },
    specifier,
    typeOnly: options.typeOnly === true,
  });
}

function messageId(result: PolicyVerdict): string {
  return result.kind === "deny" ? result.messageId : result.kind;
}

/**
 * A verdict with the as-written spelling removed.
 *
 * `data.specifier` is the one field that is SUPPOSED to differ between the two
 * adapters — it is what the reader typed, quoted back so the message points at
 * something they can find. Everything else is the semantic verdict, and that is
 * what the two callers must agree on. Comparing whole verdicts would assert the
 * two spellings are the same string, which is the opposite of the claim.
 */
function semantics(result: PolicyVerdict): unknown {
  if (result.kind !== "deny") return result;
  const { specifier: _spelling, ...rest } = result.data;
  return { kind: result.kind, messageId: result.messageId, data: rest };
}

describeSuite("the adapter contract: one edge, two spellings, one verdict", () => {
  testCase("a permitted crossing reads the same aliased and relative", () => {
    const aliased = verdict("features/billing/ui/InvoiceTable.tsx", "@/shared/ui/Button");
    const relatively = resolvedVerdict(
      "features/billing/ui/InvoiceTable.tsx",
      "../../../shared/ui/Button",
      "shared/ui/Button",
    );
    assert.equal(aliased.kind, "allow-crossing");
    assert.deepEqual(semantics(relatively), semantics(aliased));
  });

  testCase("a forbidden crossing reads the same aliased and relative", () => {
    const aliased = verdict("shared/utils.ts", "@/infrastructure/db/client");
    const relatively = resolvedVerdict(
      "shared/utils.ts",
      "../infrastructure/db/client",
      "infrastructure/db/client",
    );
    assert.equal(messageId(aliased), "deniedDirection");
    assert.deepEqual(semantics(relatively), semantics(aliased));
  });

  testCase("a deep cross-feature import reads the same aliased and relative", () => {
    const relatively = resolvedVerdict(
      "features/alpha/ui/panel.tsx",
      "../../billing/service/invoice-summary",
      "features/billing/service/invoice-summary",
    );
    assert.equal(messageId(relatively), "deniedExposure");
    assert.deepEqual(
      semantics(verdict("features/alpha/ui/panel.tsx", "@/features/billing/service/invoice-summary")),
      semantics(relatively),
    );
  });

  testCase("the canonical alias a relative crossing should have been written as", () => {
    const result = resolvedVerdict(
      "features/billing/ui/InvoiceTable.tsx",
      "../../../shared/ui/Button",
      "shared/ui/Button",
    );
    assert.equal(
      result.kind === "allow-crossing" ? result.canonicalSpecifier : undefined,
      "@/shared/ui/Button",
    );
  });

  testCase("shared/ui reaching src/shared is a crossing, though both are boundary 'shared'", () => {
    // THE hole this engine was rebuilt around. A boundary comparison sees
    // shared -> shared and stays quiet; a unit comparison sees the crossing, and
    // the policy then answers it — here by permitting it, in ONE place, rather
    // than by falling between two rules that each thought the other had it.
    const relatively = resolvedVerdict("shared/ui/Button.tsx", "../utils", "shared/utils");
    assert.equal(relatively.kind, "allow-crossing");
    assert.deepEqual(semantics(verdict("shared/ui/Button.tsx", "@/shared/utils")), semantics(relatively));
  });

  testCase("shared reaching shared/ui runs upward and is denied in both spellings", () => {
    const relatively = resolvedVerdict("shared/utils.ts", "./ui/Button", "shared/ui/Button");
    assert.equal(messageId(relatively), "deniedDirection");
    assert.deepEqual(semantics(verdict("shared/utils.ts", "@/shared/ui/Button")), semantics(relatively));
  });
});

describeSuite("the adapter contract: same-unit edges never reach the table", () => {
  testCase("a feature barrel reaching its own layers is internal, though its row is deny", () => {
    assert.equal(
      verdict("features/billing/index.ts", "@/features/billing/controllers/invoices").kind,
      "internal",
    );
    assert.equal(
      resolvedVerdict(
        "features/billing/index.ts",
        "./controllers/invoices",
        "features/billing/controllers/invoices",
      ).kind,
      "internal",
    );
  });

  testCase("a layer reaching its own feature's barrel is internal here, and layer-direction's finding", () => {
    assert.equal(verdict("features/billing/ui/InvoiceTable.tsx", "@/features/billing").kind, "internal");
  });

  testCase("one layer reaching a sibling layer is internal, and layer-direction's question", () => {
    assert.equal(
      resolvedVerdict(
        "features/billing/ui/InvoiceTable.tsx",
        "../controllers/invoices",
        "features/billing/controllers/invoices",
      ).kind,
      "internal",
    );
  });

  testCase("two files in the source root are one unit and cross nothing", () => {
    assert.equal(resolvedVerdict("client.tsx", "./router", "router").kind, "internal");
  });

  testCase("a domain barrel deep re-exporting its own modules is internal", () => {
    assert.equal(verdict("domains/pricing/index.ts", "@/domains/pricing/rate-card").kind, "internal");
  });

  testCase("ANOTHER feature is not the same unit, however it is spelled", () => {
    assert.equal(
      messageId(verdict("features/billing/ui/x.tsx", "@/features/orders/service/inventory")),
      "deniedExposure",
    );
  });
});

describeSuite("the adapter contract: the one flag, and the loud defaults", () => {
  testCase("a domain's runtime package import is denied and its type import is not", () => {
    assert.equal(messageId(verdict("domains/pricing/rate-card.ts", "zod")), "impureDomainRuntimeImport");
    assert.equal(verdict("domains/pricing/rate-card.ts", "zod", { typeOnly: true }).kind, "allow-crossing");
  });

  testCase("runtime purity is a flag on one row, not a rule about packages", () => {
    // The same package, from a repo: allowed, because the flag is the domain's.
    assert.equal(verdict("features/billing/repo/invoice-rows.ts", "zod").kind, "allow-crossing");
  });

  testCase("src/shared is inside the domain's runtime licence and the adapter layer is not", () => {
    assert.equal(verdict("domains/pricing/rate-card.ts", "@/shared/utils").kind, "allow-crossing");
    assert.equal(
      messageId(verdict("domains/pricing/rate-card.ts", "@/infrastructure/db")),
      "impureDomainRuntimeImport",
    );
  });

  testCase("a domain runtime-importing another domain is judged by the table, not by the flag", () => {
    assert.equal(
      messageId(verdict("domains/pricing/rate-card.ts", "@/domains/billing/internal/table")),
      "deniedExposure",
    );
    assert.equal(verdict("domains/pricing/rate-card.ts", "@/domains/billing").kind, "allow-crossing");
  });

  testCase("an unpoliced destination is loud rather than allowed by default", () => {
    assert.equal(messageId(verdict("shared/utils.ts", "@/lib/format-date")), "unclassifiedTarget");
  });

  testCase("an unpoliced source is loud rather than skipped", () => {
    assert.equal(messageId(verdict("lib/format-date.ts", "@/shared/utils")), "unclassifiedSource");
  });
});
