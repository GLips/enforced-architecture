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
  describeKnownAreas,
  evaluateImportPolicy,
  IMPORT_POLICY,
  type PolicyVerdict,
  type ImportSurface,
} from "./import-policy.ts";
import {
  classifySourcePath,
  classifyTargetPath,
  classifySpecifier,
  assertGoverningVocabulary,
  apiClientModule,
  browserStorageModule,
  dbDir,
  dbSchemaPath,
  featureRootModules,
  RECOMMENDED_VOCABULARY,
  rootRouteModule,
  sharedUiDir,
  sourceRootModules,
  themeModule,
  type SourceProfile,
  type TargetArea,
  type TreeVocabulary,
} from "./layout.ts";
import {
  assertDistinctDeclaredRoots,
  classifyFileRole,
  declareTrees,
  declaredTreeFor,
  type DeclaredTree,
} from "./declared-trees.ts";

// Every classifier below takes the vocabulary of the tree the path sits in. These
// cases spell the recommended one, because the rows are the recommended layout;
// the two-tree cases at the bottom are where a SECOND vocabulary is exercised.
const VOCABULARY = RECOMMENDED_VOCABULARY;

// The project root every absolute fixture path below is written under. A declared
// root is project-relative, so the resolver is given this rather than left to find
// a root inside the path — see `declaredTreeFor`.
const PROJECT_ROOT = "/repo";

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
      const from = classifySourcePath(VOCABULARY, row.from);
      assert.notEqual(from, undefined, `${row.from} classified as nothing`);
      assert.equal(from?.profile, row.profile);

      const read = classifySpecifier(VOCABULARY, row.specifier);
      assert.notEqual(read, undefined, `${row.specifier} read as nothing`);

      const area =
        read?.kind === "package"
          ? ("package" as TargetArea)
          : classifyTargetPath(VOCABULARY, read?.path ?? "")?.area;
      assert.equal(area, row.area);

      assert.deepEqual(IMPORT_POLICY[row.profile][row.area], row.surface);
    });
  }
});

describeSuite("classification: what is deliberately not classified", () => {
  testCase("a top-level directory nobody declared is unclassified, not silently exempt", () => {
    assert.equal(classifySourcePath(VOCABULARY, "lib/format-date.ts"), undefined);
    assert.equal(classifyTargetPath(VOCABULARY, "lib/format-date"), undefined);
  });

  testCase("a directory inside a feature that is not a layer is unclassified", () => {
    assert.equal(classifySourcePath(VOCABULARY, "features/billing/helpers/format.ts"), undefined);
  });

  testCase("a file at a feature root IS classified, so topology reports it alone", () => {
    // `placement/topology` rejects a root file that is not on its list. Leaving
    // it unclassified here would report one mistake twice, with two fixes named.
    assert.equal(classifySourcePath(VOCABULARY, "features/billing/constants.ts")?.profile, "feature-root");
  });

  testCase("the bare subdivided directories name no unit at all", () => {
    assert.equal(classifyTargetPath(VOCABULARY, "features"), undefined);
    assert.equal(classifyTargetPath(VOCABULARY, "domains"), undefined);
  });

  testCase("an asset and a relative path are not this tier's question", () => {
    assert.equal(classifySpecifier(VOCABULARY, "../styles.css"), undefined);
    assert.equal(classifySpecifier(VOCABULARY, "./InvoiceTable"), undefined);
    assert.equal(classifySpecifier(VOCABULARY, "@/styles.css?url"), undefined);
  });

  // The last arm, and the one a list of "aliases pointing outside the tree" used
  // to intercept. That list could not tell an alias from a package name, so
  // every entry was a package whose import policy the adopter had switched off
  // in a field that read like a path mapping. A second alias root is a package
  // here, which is what it is: something this tree imports and does not contain.
  testCase("a second alias root is a package, not a hole in the policy", () => {
    assert.deepEqual(classifySpecifier(VOCABULARY, "@assets/logo"), {
      kind: "package",
      name: "@assets/logo",
    });
    assert.deepEqual(classifySpecifier(VOCABULARY, "@core/money/decimal"), {
      kind: "package",
      name: "@core/money",
    });
  });

});

/** The evaluator, in the shape the OXLINT adapter calls it: a specifier. */
function verdict(
  from: string,
  specifier: string,
  options: { typeOnly?: boolean } = {},
): PolicyVerdict {
  const read = classifySpecifier(VOCABULARY, specifier);
  assert.notEqual(read, undefined, `${specifier} is not a specifier this helper can read`);
  return evaluateImportPolicy({
    vocabulary: VOCABULARY,
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
    vocabulary: VOCABULARY,
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


// ─── Two trees ────────────────────────────────────────────────────────
//
// Everything above spells ONE vocabulary, because the rows are the recommended
// layout. These cases are the other half of the ticket: that a file is resolved
// into the tree that OWNS it and then read with THAT tree's names.
//
// The second tree renames the features directory, so a case that passes under
// both vocabularies proves nothing here. Every assertion below is one the app
// tree's vocabulary would answer differently.

const APP_TREE: DeclaredTree = { root: "apps/web/src", vocabulary: RECOMMENDED_VOCABULARY };

const PDF_VOCABULARY: TreeVocabulary = {
  ...RECOMMENDED_VOCABULARY,
  featuresDir: "capabilities",
  // `sharedUiDir()` derives from this, so renaming the parent is the whole edit.
  // While the composite was a stored field it had to be restated here, and a
  // vocabulary that restated only one of the two was accepted.
  sharedDir: "common",
};

const PDF_TREE: DeclaredTree = { root: "packages/pdf/src", vocabulary: PDF_VOCABULARY };

const TWO_TREES: DeclaredTree[] = [APP_TREE, PDF_TREE];

describeSuite("resolving a file into the tree that owns it", () => {
  testCase("a file resolves to its own tree, with a path from THAT tree's root", () => {
    assert.deepEqual(declaredTreeFor(PROJECT_ROOT + "/apps/web/src/features/billing/ui/panel.tsx", PROJECT_ROOT, TWO_TREES), {
      tree: APP_TREE,
      sourcePath: "features/billing/ui/panel.tsx",
    });
    assert.deepEqual(declaredTreeFor(PROJECT_ROOT + "/packages/pdf/src/capabilities/render/ui/page.ts", PROJECT_ROOT, TWO_TREES), {
      tree: PDF_TREE,
      sourcePath: "capabilities/render/ui/page.ts",
    });
  });

  testCase("the second tree is read with ITS vocabulary, not the first tree's", () => {
    // `capabilities/` is this tree's features directory and `features/` is not.
    // Under the app tree's vocabulary both answers invert, which is what makes
    // this pair a test of the resolution rather than of the classifier.
    const role = classifyFileRole(PROJECT_ROOT + "/packages/pdf/src/capabilities/render/ui/page.ts", PROJECT_ROOT, TWO_TREES);
    assert.equal(role?.place?.profile, "feature-ui");
    // The unit carries the tree's OWN directory name, which is the second half
    // of reading with its vocabulary: nothing downstream has to re-derive it.
    assert.equal(role?.place?.unit, "capabilities/render");

    const asAppTreeWouldRead = classifyFileRole(PROJECT_ROOT + "/packages/pdf/src/features/render/ui/page.ts", PROJECT_ROOT, TWO_TREES);
    assert.equal(asAppTreeWouldRead?.place, undefined);
  });

  testCase("an undeclared sibling is in no tree at all, which is the whole of the scoping claim", () => {
    assert.equal(declaredTreeFor(PROJECT_ROOT + "/packages/cli/src/features/billing/ui/panel.tsx", PROJECT_ROOT, TWO_TREES), undefined);
    assert.equal(classifyFileRole(PROJECT_ROOT + "/packages/cli/src/features/billing/ui/panel.tsx", PROJECT_ROOT, TWO_TREES), undefined);
  });

  testCase("declaring the sibling is the only thing that turns it on", () => {
    const declared: DeclaredTree[] = [...TWO_TREES, { root: "packages/cli/src", vocabulary: RECOMMENDED_VOCABULARY }];
    const role = classifyFileRole(PROJECT_ROOT + "/packages/cli/src/features/billing/ui/panel.tsx", PROJECT_ROOT, declared);
    assert.equal(role?.place?.profile, "feature-ui");
  });

  testCase("the most specific root wins, so a bare root does not swallow a nested one", () => {
    const nested: DeclaredTree[] = [{ root: "src", vocabulary: RECOMMENDED_VOCABULARY }, APP_TREE];
    assert.equal(declaredTreeFor(PROJECT_ROOT + "/apps/web/src/features/billing/ui/panel.tsx", PROJECT_ROOT, nested)?.tree, APP_TREE);
  });

  // The two paths that defeated searching the absolute path for the root's
  // segment. Neither choice of occurrence answers both: taking the FIRST breaks
  // the checkout, taking the LAST breaks the nested directory. Only measuring
  // from the project root answers both, and both are pinned because a fix for one
  // that reintroduces the other reads as green.
  testCase("a checkout living under a directory called src is not mistaken for the tree", () => {
    const single: DeclaredTree[] = [{ root: "src", vocabulary: RECOMMENDED_VOCABULARY }];
    assert.deepEqual(
      declaredTreeFor("/home/me/src/repo/src/features/billing/ui/panel.tsx", "/home/me/src/repo", single),
      { tree: single[0], sourcePath: "features/billing/ui/panel.tsx" },
    );
  });

  testCase("a directory called src nested INSIDE the tree is an ordinary directory", () => {
    // The `lastIndexOf` version resolved this to the source-root module
    // `helper.ts`, so the oxlint tier read a feature's service file as a root
    // entrypoint while the structural tier, which measures from the root it was
    // given, read it correctly — one file, two positions, two policies.
    const single: DeclaredTree[] = [{ root: "src", vocabulary: RECOMMENDED_VOCABULARY }];
    assert.deepEqual(
      declaredTreeFor(PROJECT_ROOT + "/src/features/billing/service/src/helper.ts", PROJECT_ROOT, single),
      { tree: single[0], sourcePath: "features/billing/service/src/helper.ts" },
    );
  });

  testCase("a file outside the project root is in no tree, whatever its path spells", () => {
    const single: DeclaredTree[] = [{ root: "src", vocabulary: RECOMMENDED_VOCABULARY }];
    assert.equal(
      declaredTreeFor("/elsewhere/src/features/billing/ui/panel.tsx", PROJECT_ROOT, single),
      undefined,
    );
  });

  testCase("the longest declaration that prefixes the path wins", () => {
    const nested: DeclaredTree[] = [{ root: "src", vocabulary: RECOMMENDED_VOCABULARY }, APP_TREE];
    assert.deepEqual(declaredTreeFor(PROJECT_ROOT + "/apps/web/src/features/billing/ui/panel.tsx", PROJECT_ROOT, nested), {
      tree: APP_TREE,
      sourcePath: "features/billing/ui/panel.tsx",
    });
  });

  testCase("a position inside a declared tree that no profile claims is loud, not silent", () => {
    const role = classifyFileRole(PROJECT_ROOT + "/packages/pdf/src/lib/stray.ts", PROJECT_ROOT, TWO_TREES);
    assert.notEqual(role, undefined);
    assert.equal(role?.place, undefined);
  });

  testCase("an architecture-exempt file inside a declared tree has no subject", () => {
    assert.equal(classifyFileRole(PROJECT_ROOT + "/apps/web/src/features/billing/ui/panel.test.tsx", PROJECT_ROOT, TWO_TREES), undefined);
    assert.equal(classifyFileRole(PROJECT_ROOT + "/apps/web/src/scripts/backfill.ts", PROJECT_ROOT, TWO_TREES), undefined);
  });
});

describeSuite("the unclassified message names a destination in the tree's own words", () => {
  // The verdict is the same either way — this is the WORDING, which is the whole
  // product of `describeKnownAreas` and the reason `unclassifiedSource` is a
  // blocking message a reader can act on rather than a refusal with no exit.
  testCase("the recommended tree is described in the recommended directory names", () => {
    const areas = describeKnownAreas(RECOMMENDED_VOCABULARY);
    assert.match(areas, /\bfeatures\/<name>\/\(ui\|controllers\|service\|repo\)/);
    assert.match(areas, /\bshared\/ui\b/);
    assert.doesNotMatch(areas, /\bcapabilities\b/);
  });

  testCase("a renaming tree is described in ITS names, so the message never prescribes a directory the tree does not have", () => {
    const areas = describeKnownAreas(PDF_VOCABULARY);
    assert.match(areas, /\bcapabilities\/<name>\/\(ui\|controllers\|service\|repo\)/);
    assert.match(areas, /\bcommon\/ui\b/);
    // The load-bearing half: no spelling from the OTHER tree leaks in. A
    // hardcoded `features` here would pass every match above.
    assert.doesNotMatch(areas, /\bfeatures\b/);
    assert.doesNotMatch(areas, /(^|[^/])\bshared\b/);
  });

  testCase("the areas string reaches the verdict, so the message a rule prints is the tree's", () => {
    const denied = evaluateImportPolicy({
      vocabulary: PDF_VOCABULARY,
      sourcePath: "lib/stray.ts",
      target: { kind: "module", path: "capabilities/render" },
      specifier: "@/capabilities/render",
      typeOnly: false,
    });
    assert.equal(messageId(denied), "unclassifiedSource");
    assert.equal(denied.kind === "deny" ? denied.data.areas : "", describeKnownAreas(PDF_VOCABULARY));
  });
});

describeSuite("a vocabulary cannot declare its own tree out of existence", () => {
  // Every case below is a vocabulary that reads as fully adopted and leaves a
  // position, a tree, or a whole rule governed by nothing. The recommended
  // vocabulary is checked alongside the rejections, because a validator that
  // rejects everything passes the negative cases just as well.
  testCase("the recommended vocabulary is accepted", () => {
    assert.doesNotThrow(() => assertGoverningVocabulary(RECOMMENDED_VOCABULARY, "src"));
  });

  // `generatedDir` REMOVES subjects too, in both tiers and in the shipped
  // ignore pattern the harness derives from it. `**` is the whole catalog
  // switched off while every rule still appears enabled.
  testCase("a directory name is accepted, leading dot and all", () => {
    for (const dir of ["gen", "__generated__", ".generated"]) {
      const generated: TreeVocabulary = { ...RECOMMENDED_VOCABULARY, generatedDir: dir };
      assert.doesNotThrow(() => assertGoverningVocabulary(generated, "src"));
    }
  });

  // Each of these is a distinct glob SYNTAX, and that is the point: the
  // banned-character version of the check refused `*` and `?` and accepted brace
  // expansion, character classes and negation, each of which composes into an
  // ignore pattern the vocabulary never declared. `{features,gen}` is the one a
  // review actually used to exempt `src/features/**` with a green run.
  for (const dir of ["**", "gen*", "gen?", "{features,gen}", "[a-z]en", "!gen", "@(gen)", "gen/client"]) {
    testCase(`a generatedDir spelled "${dir}" is refused — the pattern would be the adopter's`, () => {
      const silenced: TreeVocabulary = { ...RECOMMENDED_VOCABULARY, generatedDir: dir };
      assert.throws(() => assertGoverningVocabulary(silenced, "src"), /not a single path segment/);
    });
  }

  testCase("the tree root itself, spelled as a dot, is refused", () => {
    const silenced: TreeVocabulary = { ...RECOMMENDED_VOCABULARY, generatedDir: "." };
    assert.throws(() => assertGoverningVocabulary(silenced, "src"), /not a single path segment/);
  });

  // A name collision does not fail loudly — it ERASES.
  testCase("two top-level positions sharing a name would classify one as the other", () => {
    const collided: TreeVocabulary = { ...RECOMMENDED_VOCABULARY, domainsDir: "features" };
    assert.throws(() => assertGoverningVocabulary(collided, "src"), /spells both/);
  });

  testCase("a generated directory that IS a governed position exempts the whole position", () => {
    const exempted: TreeVocabulary = { ...RECOMMENDED_VOCABULARY, generatedDir: "features" };
    assert.throws(() => assertGoverningVocabulary(exempted, "src"), /also its featuresDir/);
  });

  testCase("two feature layers sharing a name collapse three roles onto one", () => {
    const collided: TreeVocabulary = {
      ...RECOMMENDED_VOCABULARY,
      featureLayerDirs: { ui: "ui", controllers: "ui", service: "ui", repo: "ui" },
    };
    assert.throws(() => assertGoverningVocabulary(collided, "src"), /spells both/);
  });

  testCase("one barrel name for both barrels erases the client/server distinction", () => {
    const collided: TreeVocabulary = { ...RECOMMENDED_VOCABULARY, serverBarrelModule: "index" };
    assert.throws(() => assertGoverningVocabulary(collided, "src"), /spells both/);
  });

  testCase("a name that is a path is not a name", () => {
    const path: TreeVocabulary = { ...RECOMMENDED_VOCABULARY, sharedUiSubdir: "ui/primitives" };
    assert.throws(() => assertGoverningVocabulary(path, "src"), /not a single path segment/);
  });

  // Syntactically perfect names that make a governed position architecture-exempt.
  // Every one of these passed `assertGoverningVocabulary`, and every representative
  // file then came back undefined from `classifyFileRole` — the position named in
  // the vocabulary as policed and silent in both tiers. `declareTrees` is the
  // caller under test, because the point is that DECLARING a tree is what holds a
  // vocabulary to this.
  for (const [label, vocabulary] of [
    ["a features directory called scripts", { ...RECOMMENDED_VOCABULARY, featuresDir: "scripts" }],
    ["a features directory called test", { ...RECOMMENDED_VOCABULARY, featuresDir: "test" }],
    ["a routes directory called __tests__", { ...RECOMMENDED_VOCABULARY, routesDir: "__tests__" }],
    [
      "a service layer called scripts",
      {
        ...RECOMMENDED_VOCABULARY,
        featureLayerDirs: { ...RECOMMENDED_VOCABULARY.featureLayerDirs, service: "scripts" },
      },
    ],
    ["a server suffix of .test", { ...RECOMMENDED_VOCABULARY, serverModuleSuffix: ".test" }],
    ["a server suffix of .gen", { ...RECOMMENDED_VOCABULARY, serverModuleSuffix: ".gen" }],
    ["a server suffix of .d", { ...RECOMMENDED_VOCABULARY, serverModuleSuffix: ".d" }],
    ["a client barrel called index.d", { ...RECOMMENDED_VOCABULARY, clientBarrelModule: "index.d" }],
    // The composites and the env modules — the fields the first version of this
    // walk did not reach. Same failure, one level of joining away.
    ["a db directory called scripts", { ...RECOMMENDED_VOCABULARY, dbSubdir: "scripts" }],
    ["a schema directory called scripts", { ...RECOMMENDED_VOCABULARY, dbSchemaSubdir: "scripts" }],
    ["an api client called api.test", { ...RECOMMENDED_VOCABULARY, apiClientName: "api.test" }],
    ["browser storage called storage.gen", { ...RECOMMENDED_VOCABULARY, browserStorageName: "storage.gen" }],
    ["an env module called env.test", { ...RECOMMENDED_VOCABULARY, envModules: { "env.test": "env-server" } }],
    // The two ROOT-POSITION records. These were skipped on the theory that a
    // position which permits a file does not govern one — but the file is
    // hand-written, sits in a declared tree, and is named in the vocabulary, and
    // an exempt spelling drops it out of `classifyFileRole` exactly like any
    // other position. `sourceRootPositions.routeTree` is the only role still
    // excluded, and the legal case below is what says so.
    [
      "a feature errors module called errors.test",
      {
        ...RECOMMENDED_VOCABULARY,
        featureRootPositions: { ...RECOMMENDED_VOCABULARY.featureRootPositions, errors: "errors.test" },
      },
    ],
    [
      "a client entry called client.test",
      {
        ...RECOMMENDED_VOCABULARY,
        sourceRootPositions: { ...RECOMMENDED_VOCABULARY.sourceRootPositions, clientEntry: "client.test" },
      },
    ],
    [
      "a router module called router.gen",
      {
        ...RECOMMENDED_VOCABULARY,
        sourceRootPositions: { ...RECOMMENDED_VOCABULARY.sourceRootPositions, router: "router.gen" },
      },
    ],
  ] as [string, TreeVocabulary][]) {
    testCase(`${label} exempts a governed position from every rule`, () => {
      assert.throws(
        () => declareTrees([{ root: "src", vocabulary }]),
        /architecture-exempt/,
      );
    });
  }

  // The one role excluded, and the reason the exclusion is BY ROLE rather than by
  // record: the recommended vocabulary's own `routeTree.gen` is generated output,
  // exempt by its own name, and a check that held every root position to a
  // non-exempt spelling would reject the correct declaration. Its siblings in the
  // same record are checked — the loop above proves that — so this pins a narrow
  // exception rather than a skipped record.
  testCase("the generated routeTree may name itself exempt and nothing else may", () => {
    assert.doesNotThrow(() =>
      declareTrees([{ root: "src", vocabulary: RECOMMENDED_VOCABULARY }]),
    );
    assert.strictEqual(RECOMMENDED_VOCABULARY.sourceRootPositions.routeTree, "routeTree.gen");
  });

  // An empty list is every tree-scoped rule switched off, and it is the one value
  // the BRAND cannot refuse on its own: with the brand on the elements rather
  // than the array, `[]` satisfied the type vacuously and typechecked clean.
  testCase("declaring no trees at all is the whole catalog switched off", () => {
    assert.throws(() => declareTrees([]), /No trees declared/);
  });

  // Validated once, then reassigned. Freezing the caller's own array is what
  // makes the brand a claim about the value rather than about one moment.
  testCase("a validated list cannot be edited afterwards", () => {
    const trees = declareTrees([{ root: "src", vocabulary: RECOMMENDED_VOCABULARY }]);
    assert.throws(() => {
      (trees as unknown as DeclaredTree[])[0]!.root = "../outside";
    });
    assert.equal(trees[0]?.root, "src");
    assert.throws(() => {
      (trees[0]!.vocabulary.featureLayerDirs as Record<string, string>).ui = "scripts";
    });
  });

  // The caller freezing its OWN array first was the way past the freeze: a
  // descent gated on `isFrozen` returned at the outer container and left every
  // tree and vocabulary inside it writable — validated once, then edited, with
  // the brand still sitting on the value.
  testCase("a list the caller froze first is still frozen all the way down", () => {
    const trees = declareTrees(
      Object.freeze([{ root: "src", vocabulary: RECOMMENDED_VOCABULARY }]),
    );
    assert.throws(() => {
      (trees as unknown as DeclaredTree[])[0]!.root = "../outside";
    });
    assert.throws(() => {
      (trees[0]!.vocabulary.featureLayerDirs as Record<string, string>).ui = "scripts";
    });
    assert.equal(trees[0]?.root, "src");
    assert.equal(trees[0]?.vocabulary.featureLayerDirs.ui, RECOMMENDED_VOCABULARY.featureLayerDirs.ui);
  });

  testCase("declaring the recommended vocabulary is accepted by the factory too", () => {
    assert.doesNotThrow(() => declareTrees([{ root: "src", vocabulary: RECOMMENDED_VOCABULARY }]));
  });

  testCase("one root declared twice is governed by one vocabulary and checked by two", () => {
    const twice: DeclaredTree[] = [
      { root: "src", vocabulary: RECOMMENDED_VOCABULARY },
      { root: "src", vocabulary: { ...RECOMMENDED_VOCABULARY, featuresDir: "capabilities" } },
    ];
    assert.throws(() => assertDistinctDeclaredRoots(twice), /declared twice/);
  });

  // The empty string is the shape every one of these shares: as a prefix it
  // matches every specifier, as a suffix it ends every filename, and as an
  // extension it is the tail of every path. It reads like an unset field and
  // behaves like a rule switched off.
  testCase("an empty alias prefix makes every package an in-tree module", () => {
    const silenced: TreeVocabulary = { ...RECOMMENDED_VOCABULARY, aliasPrefix: "" };
    assert.throws(() => assertGoverningVocabulary(silenced, "src"), /empty aliasPrefix/);
  });

  testCase("an empty server suffix makes every file server-only", () => {
    const silenced: TreeVocabulary = { ...RECOMMENDED_VOCABULARY, serverModuleSuffix: "" };
    assert.throws(() => assertGoverningVocabulary(silenced, "src"), /serverModuleSuffix/);
  });

  // Neither of the next two is empty, and neither reads as a switch. A suffix
  // carrying an extension or a separator matches NO file, so every server-only
  // module in the tree reads as client-safe — the same silence as the empty one,
  // arrived at from the opposite end.
  for (const suffix of [".server.ts", ".server/", ".*", ".", ".server.jsx"]) {
    testCase(`a server suffix spelled "${suffix}" classifies every server module as client`, () => {
      const wrong: TreeVocabulary = { ...RECOMMENDED_VOCABULARY, serverModuleSuffix: suffix };
      assert.throws(() => assertGoverningVocabulary(wrong, "src"), /serverModuleSuffix/);
    });
  }

  // A module name here is spelled the way an IMPORT spells it. The classifiers
  // strip the extension off the file before comparing, so a name carrying one
  // matches nothing: `clientBarrelModule: "index.ts"` makes every barrel classify
  // as a feature ROOT and sends the barrel walkers looking for `index.ts.ts`.
  for (const [field, value] of [
    ["clientBarrelModule", "index.ts"],
    ["serverBarrelModule", "index.server.ts"],
    ["themeModuleName", "theme.tsx"],
    ["rootRouteName", "__root.tsx"],
  ] as const) {
    testCase(`${field} carrying a source extension matches no file`, () => {
      const extended: TreeVocabulary = { ...RECOMMENDED_VOCABULARY, [field]: value };
      assert.throws(() => assertGoverningVocabulary(extended, "src"), /carries a source extension/);
    });
  }

  testCase("a root position carrying an extension is caught by the same loop", () => {
    const extended: TreeVocabulary = {
      ...RECOMMENDED_VOCABULARY,
      sourceRootPositions: { ...RECOMMENDED_VOCABULARY.sourceRootPositions, clientEntry: "client.tsx" },
    };
    assert.throws(
      () => assertGoverningVocabulary(extended, "src"),
      /sourceRootPositions\.clientEntry/,
    );
  });

  testCase("an env module spelled as a glob is a pattern in a name's costume", () => {
    const patterned: TreeVocabulary = {
      ...RECOMMENDED_VOCABULARY,
      envModules: { "env.*": "env-server" },
    };
    assert.throws(() => assertGoverningVocabulary(patterned, "src"), /not a single path segment/);
  });

  testCase("a server suffix without its dot is not a suffix on a module name", () => {
    const bare: TreeVocabulary = { ...RECOMMENDED_VOCABULARY, serverModuleSuffix: "server" };
    assert.throws(() => assertGoverningVocabulary(bare, "src"), /serverModuleSuffix/);
  });

  testCase("an empty extension entry is the suffix of every path", () => {
    const silenced: TreeVocabulary = {
      ...RECOMMENDED_VOCABULARY,
      assetExtensions: [...RECOMMENDED_VOCABULARY.assetExtensions, ""],
    };
    assert.throws(() => assertGoverningVocabulary(silenced, "src"), /not an extension/);
  });

  testCase("an extension written with its dot is refused, because the walks add one", () => {
    const dotted: TreeVocabulary = {
      ...RECOMMENDED_VOCABULARY,
      stylesheetExtensions: [".css"],
      assetExtensions: [...RECOMMENDED_VOCABULARY.assetExtensions, ".css"],
    };
    assert.throws(() => assertGoverningVocabulary(dotted, "src"), /not an extension/);
  });

  testCase("a stylesheet extension the import side does not know is refused", () => {
    const forked: TreeVocabulary = { ...RECOMMENDED_VOCABULARY, stylesheetExtensions: ["styl"] };
    assert.throws(() => assertGoverningVocabulary(forked, "src"), /not an asset extension/);
  });

  testCase("a second spelling of one root passes a string comparison and is refused here", () => {
    const equivalent: DeclaredTree[] = [
      { root: "src", vocabulary: RECOMMENDED_VOCABULARY },
      { root: "./src", vocabulary: RECOMMENDED_VOCABULARY },
    ];
    assert.throws(() => assertDistinctDeclaredRoots(equivalent), /not written canonically/);
  });

  testCase("a trailing slash is the same directory written a third way", () => {
    const trailing: DeclaredTree[] = [{ root: "src/", vocabulary: RECOMMENDED_VOCABULARY }];
    assert.throws(() => assertDistinctDeclaredRoots(trailing), /not written canonically/);
  });

  // A root that is a PATTERN is the config knob this catalog forbids arriving as
  // a root instead of a rule scope, and its failure is worse than a misspelling:
  // the oxlint override "src*/**" still matches files under src, so the tier
  // looks configured, while `declaredTreeFor` compares the literal prefix "src*/"
  // and the structural walk resolves a directory that is not there. Declared and
  // policed by nothing.
  for (const pattern of ["src*", "src?", "{src,app}", "src/[a-z]*", "!src", "src\\web"]) {
    testCase(`a root spelled "${pattern}" is a pattern, not a directory`, () => {
      const globbed: DeclaredTree[] = [{ root: pattern, vocabulary: RECOMMENDED_VOCABULARY }];
      assert.throws(() => assertDistinctDeclaredRoots(globbed), /not written canonically/);
    });
  }

  testCase("two DIFFERENT roots are the monorepo case and stay legal", () => {
    const both: DeclaredTree[] = [
      { root: "apps/web/src", vocabulary: RECOMMENDED_VOCABULARY },
      { root: "packages/core/src", vocabulary: RECOMMENDED_VOCABULARY },
    ];
    assert.doesNotThrow(() => assertDistinctDeclaredRoots(both));
  });

});

describeSuite("a renamed parent directory moves every path derived from it", () => {
  // The pairs Codex found: each composite used to be a STORED field beside its
  // own parent, so renaming the parent left the composite pointing at a
  // directory that no longer existed — and both rules still matched something,
  // so nothing went red. These assert the derivation, which is the only thing
  // that makes CLAUDE.md's "one place to change it" true of these names.
  const RENAMED: TreeVocabulary = {
    ...RECOMMENDED_VOCABULARY,
    infrastructureDir: "adapters",
    sharedDir: "common",
    routesDir: "screens",
  };

  testCase("the db paths follow the infrastructure directory", () => {
    assert.equal(dbDir(RENAMED), "adapters/db");
    assert.equal(dbSchemaPath(RENAMED), "adapters/db/schema");
  });

  testCase("the capability owners follow it too", () => {
    assert.equal(apiClientModule(RENAMED), "adapters/api-client");
    assert.equal(browserStorageModule(RENAMED), "adapters/browser-storage");
  });

  testCase("the shared UI directory and the token source follow the shared directory", () => {
    assert.equal(sharedUiDir(RENAMED), "common/ui");
    assert.equal(themeModule(RENAMED), "common/ui/theme");
  });

  testCase("the root route follows the routes directory", () => {
    assert.equal(rootRouteModule(RENAMED), "screens/__root");
  });

  testCase("a renamed barrel is permitted at a feature root under its NEW name only", () => {
    const renamedBarrel: TreeVocabulary = { ...RECOMMENDED_VOCABULARY, clientBarrelModule: "api" };
    const permitted = featureRootModules(renamedBarrel);
    assert.ok(permitted.includes("api"));
    // The load-bearing half. While this list stored "index.ts" literally,
    // topology kept permitting the old name after every other rule had followed
    // the rename — a barrel the tree no longer has, allowed at every root.
    assert.ok(!permitted.includes("index"));
  });

  // The type refuses an extra key in a literal, which is the whole reason these
  // are records. It cannot refuse one on a value that arrived already typed as a
  // string record — so the readers go through the ROLE set instead, and a name
  // that is not a role permits nothing however it got into the object.
  testCase("a root position that is not a role permits nothing", () => {
    const smuggled: TreeVocabulary = {
      ...RECOMMENDED_VOCABULARY,
      featureRootPositions: { ...RECOMMENDED_VOCABULARY.featureRootPositions, helpers: "helpers" },
      sourceRootPositions: { ...RECOMMENDED_VOCABULARY.sourceRootPositions, lib: "lib" },
    } as TreeVocabulary;
    assert.ok(!featureRootModules(smuggled).includes("helpers"));
    assert.ok(!sourceRootModules(smuggled).includes("lib"));
    assert.ok(featureRootModules(smuggled).includes("errors"));
    assert.ok(sourceRootModules(smuggled).includes("router"));
  });

  testCase("the source root permits exactly the env modules the tree declares", () => {
    const splitOnly: TreeVocabulary = {
      ...RECOMMENDED_VOCABULARY,
      envModules: { "env.server": "env-server", "env.client": "env-client" },
    };
    const permitted = sourceRootModules(splitOnly);
    assert.ok(permitted.includes("env.server"));
    assert.ok(permitted.includes("env.client"));
    // A tree that dropped the combined module must not still permit it at the
    // root: the file would sit there governed by no env row at all.
    assert.ok(!permitted.includes("env"));
  });
});
