// Copy to the repo root as `oxlint.config.ts`.
//
// TypeScript rather than a JSON `.oxlintrc`, and the reason is not ergonomics. Four
// facts in this file have to agree with something outside it — the declared tree
// roots, the generated directories, the plugin's rule list, and the built-in
// plugin count. As JSON all four were transcriptions kept equal by hand, and each
// one failed silently in a different way: a glob that named no directory, a rule
// registered and never run, a plugin word dropped and thirteen rules gone. Here
// three of the four are COMPUTED from their source and the fourth is asserted at
// load, so the failure mode moves from a green run that checked less to a config
// that refuses to start.
//
// ONE CONFIG FILE PER DIRECTORY, and oxlint enforces it: with a JSON `.oxlintrc`
// beside this file it refuses to start — "Only one of `.oxlintrc.json` and
// `oxlint.config.ts` is allowed per directory." Migrating is a swap, not an
// addition: delete the JSON.
//
// In a monorepo this file belongs at the ROOT, with oxlint as a root dependency.
// Without both there is no single oxlint to run from the root and nothing telling
// it where the plugin module is, so `npx oxlint` pulls a stray version and lints
// with none of the architecture rules loaded — a green run that checked nothing.
// Nested config files load automatically for workspaces that need their own rule
// set (`--disable-nested-config` turns that off).
//
// Suppressing one line: `// oxlint-disable-next-line arch/db-isolation`. Position
// matters for some built-ins — `react-hooks/exhaustive-deps` wants the comment
// above the dependency array, not above the hook call. Probe rather than assume.
//
// TYPECHECK THIS FILE. Add it to the oxlint tier's program
// (`setup/oxlint.tsconfig.json`) so the severity table below is checked against
// the plugin's actual exports at build time as well as at load time. Without it
// the runtime assertion at the bottom is the only guard, which is enough to be
// safe and late enough to be annoying.

import { defineConfig } from "oxlint";
import { fileURLToPath } from "node:url";
import archPlugin from "./lint/oxlint/plugin.ts";
import { DECLARED_TREES } from "./lint/policy/declared-trees.ts";

// ── the four derivations ────────────────────────────────────────────────────

/**
 * The plugin module, resolved ABSOLUTELY.
 *
 * A relative specifier works in a config oxlint loads directly and is REJECTED in
 * one reached through `extends` — "Relative JS plugin specifiers are not supported
 * in configs provided via `extends` in `oxlint.config.ts`. Use a package name or
 * an absolute path instead." A monorepo whose workspaces extend this file is
 * exactly that case, and it is the arrangement the setup docs recommend, so the
 * relative form is a trap laid for the second reader. JSON could not express the
 * fix; this is the whole of it.
 */
const ARCH_PLUGIN_PATH = fileURLToPath(new URL("./lint/oxlint/plugin.ts", import.meta.url));

/**
 * One `<root>/**` glob per declared tree, built from the roots themselves.
 *
 * While this was a hand-written list it had to be kept equal to
 * `declared-trees.ts` character for character, and `assertDistinctDeclaredRoots`
 * still says so in its own error text. A root declared in one file and missing
 * from the other is a tree that reads as governed and is policed by nothing —
 * no findings, no diagnostic. Derivation is what makes that state unreachable
 * rather than merely checked for.
 */
const TREE_GLOBS = DECLARED_TREES.map((tree) => `${tree.root}/**`);

/**
 * Each tree's generated directory, for the BUILT-IN rules.
 *
 * Every `arch/` rule already skips these — `isArchitectureExemptSourcePath` reads
 * the same `generatedDir`, in both tiers — but `typescript/` and `sonarjs/` know
 * nothing about that predicate, so without this an adopting project lints its own
 * code generator's output on day one. The two must agree: while only the config
 * pattern read the list, `src/gen/client.ts` was a file oxlint never opened and a
 * blocking structural finding at the same time.
 *
 * Widening this means declaring a directory as generated in `declared-trees.ts`,
 * which is a claim about the tree rather than a rule switched off. There is no
 * longer anywhere here to write a hand path, which is the point.
 */
const GENERATED_GLOBS = DECLARED_TREES.map(
  (tree) => `${tree.root}/${tree.vocabulary.generatedDir}/**`,
);

/**
 * The BUILT-IN plugin set, and writing it at all is the hazard.
 *
 * oxlint's implicit default is exactly `["unicorn", "typescript", "oxc"]`; an
 * explicit array REPLACES that default rather than adding to it. So `["react"]`
 * alone unloads three plugins this config leans on, and it does it SILENTLY — a
 * rule named below whose plugin is missing here is dropped with no error and no
 * diagnostic, which reads exactly like a file with nothing wrong in it.
 *
 * The count is the check, and `npx oxlint --print-config` prints it: on oxlint
 * 1.79 this array yields 142 built-in rules, no `plugins` key at all yields 111
 * and both `react/` rules vanish, and `["react"]` alone yields 88 — each time
 * silently. `react` is the addition here; the other three are the default
 * restated. Count before and after any edit to this line.
 *
 * `unicorn` earns its place even though no `unicorn/` key appears below: it
 * carries 13 rules through the correctness CATEGORY — `no-invalid-fetch-options`
 * and `no-await-in-promise-methods` among them — so dropping the word because the
 * rules block never says it costs all 13 with no error. A plugin is named for what
 * its category contributes, not only for what this file spells out.
 *
 * `jsPlugins` entries do NOT belong here — `arch` and `sonarjs` are registered by
 * that array and are unaffected by what this one says.
 *
 * This is the one derivation the file cannot make: the count lives inside the
 * oxlint binary, and reading it means shelling out. It stays a hand-written array
 * next to the number it should produce.
 */
const BUILTIN_PLUGINS = ["react", "unicorn", "typescript", "oxc"];

// ── the tree-scoped severity table ──────────────────────────────────────────
//
// Registration and activation are separate, and only one of them used to fail
// loudly. A rule the plugin exports but this table never names was loaded and
// never run: no warning, no output, exit 0. A key naming a rule the plugin does
// NOT export is fatal. The typo was caught; the omission was not.
//
// `ArchRuleName` closes that: the table is keyed by the plugin's own rule names,
// so a missing entry is a type error and a misspelt one cannot be written. The
// assertion at the bottom of this file repeats it at load, for a project that does
// not add this file to a program.
//
// Keep each key equal to its file name (`lint/oxlint/boundary/db-isolation.ts` ->
// `db-isolation`) so the diagnostic id is also the path to the rule that raised
// it: `error arch(db-isolation): …`
//
// Every severity here is read off the rule's own header rather than decided here.
// A header opens with one of two labels, and the label IS the severity:
// `Makes sure:` claims a property the codebase can rely on, which only holds if
// the build stops when it breaks — `error`. `Shows:` reports something a reader
// learns, which a build has no business failing on — `warn`.
//
// NOT ENFORCED, either direction. `harness/run-rule-fixtures.ts` fails a rule whose
// header carries neither label, and stops there — nothing reads the severity
// column, so a header relabelled from `Shows:` to `Makes sure:` leaves the value
// here stale and `npm run check` green. Re-derive the column by hand whenever a
// label moves.
//
// A project that wants a warning to block edits the severity here and leaves the
// header alone: the label says what the rule BUYS, not what this project decided
// to do about it.

type ArchRuleName = keyof typeof archPlugin.rules;

/**
 * `arch/no-module-mocking` is the one rule NOT in this table.
 *
 * Its subject is test files, which every other rule in the catalog treats as no
 * subject at all. It reads no declared tree, so a tree glob would not narrow WHICH
 * files it judges — it would just stop it seeing the suites that live outside one,
 * the repo-root `test/` directory included. It is enabled globally below.
 * `harness/run-rule-fixtures.ts` derives this split from the rule sources and
 * fails the build if a rule is in the wrong block, in either direction.
 */
const GLOBAL_ARCH_RULE = "no-module-mocking" satisfies ArchRuleName;

const TREE_SCOPED: Record<Exclude<ArchRuleName, typeof GLOBAL_ARCH_RULE>, "error" | "warn"> = {
  // ── api: what a unit's surface is, and who may name which half of it ──
  "barrel-direction": "error",
  "server-import-context": "error",

  // ── boundary: what may cross into a tree, and what may not leave one ──
  "ambient-globals": "error",
  "client-server-infra": "error",
  "db-isolation": "error",
  "import-policy": "error",
  "no-test-imports": "error",
  "route-thinness": "error",
  "sdk-containment": "error",
  "server-no-upward": "error",

  // ── effect: failures stay typed, services stay in the requirements ──
  // ONE of these is dormant in a project that does not use Effect.
  // `no-nested-layer-provide` tests for the `Layer.` namespace before matching, and
  // is the only rule here that tests a namespace at all. The other five match on a
  // member or tag NAME alone — each says so in its own header — so all five report
  // on non-Effect code today:
  //   `no-effect-catchallcause` on any `x.catchAllCause(…)`
  //   `no-service-option` on any `x.serviceOption(…)`
  //   `no-silent-error-swallow` on any `x.catchAll(() => y.void)`
  //   `no-sql-type-parameter` on any tag named `sql`, which is postgres.js and
  //     Kysely as much as `@effect/sql`
  //   `no-disable-validation` on any `.make(props, opts)` carrying a
  //     `disableValidation` property
  // Each is still the right verdict on those call sites. Read the five as rules
  // this project takes now, not as ones awaiting an Effect adoption — adopting the
  // tag on the reading that it is mostly dormant is adopting five live rules by
  // accident.
  "no-disable-validation": "error",
  "no-effect-catchallcause": "error",
  "no-nested-layer-provide": "error",
  "no-service-option": "error",
  "no-silent-error-swallow": "error",
  // Turning this one off does not fall back to `no-type-argument-assertion`: it is
  // the only rule that holds the `sql` name, so off here is off everywhere.
  "no-sql-type-parameter": "error",

  // ── health: what a reader has to hold in one screenful ──
  // The other three health checks are whole-tree and run in the structural tier.
  // This one is per-file because a comment's length is visible in the file that
  // holds it, and it blocks: a comment nobody re-reads is a comment that goes
  // stale, and a warning here is one an agent writes past.
  //
  // Three numbers, and the defaults are `{ maxWords: 60, maxLines: 15,
  // headerMultiple: 2 }` — the run opening a file introduces the module and gets
  // twice the room. Set them from this codebase rather than taking them, the same
  // way `health/file-size`'s two are set. What is not on offer is a list of files
  // that may be long.
  "no-long-comments": "error",
  // Two numbers about one function, and neither can be derived from the other: how
  // much CONTROL FLOW a reader holds to follow one path through it, and how much
  // STATE is in flight while they do. A function can be bad at either
  // independently — the worst function measured while these were built had nesting
  // of two and five accumulators, which the flow number cannot see.
  //
  // Both WARN, unlike the comment rule above, and for the reason `hook-count` does:
  // a parser, a scheduler and a diff are legitimately these shapes, and the fix is
  // a decision about what the function's phases are rather than an edit that fits
  // in the change that tripped the count. Blocking here stops the work mid-change
  // instead of shaping it.
  //
  // Defaults are 20 and 4, and both were measured rather than picked — see each
  // rule's header for what against.
  "cognitive-complexity": "warn",
  "accumulator-count": "warn",
  // The third number, and the only one of the three about a function's SHAPE rather
  // than its insides: a long body handing back a wide object is a module that never
  // got split, and its members are the exports it would have had. Both thresholds
  // have to be met — `{ minMembers: 10, minLines: 150 }` — because neither means
  // anything alone.
  "return-width": "warn",

  // ── naming: an exported name is an address you can search for ──
  "no-vacant-symbol-names": "error",

  // ── placement: the one directory each kind of declaration lives in ──
  "deprecated-paths": "error",
  "no-deprecated-input-validator": "error",
  "no-plain-export-in-server-fn-module": "error",
  "no-raw-result": "error",
  "schema-placement": "error",
  "server-fn-placement": "error",
  "server-fn-validation": "error",

  // ── react: effects clean up, and a component's size is a number ──
  // State derivation is NOT here: `react/set-state-in-effect` and
  // `react/no-deriving-state-in-effects` own it, in the global block below.
  "no-async-effect": "error",
  // Every write names the bundle of keys it stales, from the tree's query-keys
  // module. Name genuinely read-only mutations in `readOnlyMutations`, each with why.
  "mutation-refresh-keys": ["error", { readOnlyMutations: {} }],
  // Every suspense read goes through the tree's primed-read wrapper, whose dev report names a
  // read no route loader primed: on a cold navigation it holds the page for React's 300ms throttle.
  "primed-suspense-reads": "error",
  // Counts, not properties. Each reports a number a reader uses to decide what to
  // split next, and a component that collects many hooks or many props by design is
  // not a defect.
  "hook-count": "warn",
  "prop-count": "warn",
  "single-component-export": "warn",

  // ── style: every visual value names a token, and every vendor component is
  //    reached through its wrapper ──
  "no-arbitrary-class-values": "error",
  "no-inline-color": "error",
  "no-inline-font-size": "error",
  "no-inline-style-prop": "error",
  "no-raw-primitives": "error",
  "vendor-component-containment": "error",

  // ── types: no value arrives somewhere claiming a type nothing checked ──
  // Five of this tag's twelve rules run here. The other seven ask what a
  // declaration MEANS rather than how it is spelled, which this tier cannot answer,
  // and they run in the structural tier against a real checker —
  // `structural/types/`, registered in `structural/registry.ts` and proved by
  // `check:structural`. A project that runs oxlint and not the structural tier has
  // five of the twelve, not twelve.
  "no-chained-type-assertions": "error",
  "no-reflect-access": "error",
  "no-type-argument-assertion": "error",
  "require-safety-comment": "error",
  // A report on a spread that could have been written plainly, not a property
  // anything depends on.
  "no-conditional-empty-object-spread": "warn",
};

/** `{ "arch/db-isolation": "error", … }` — the table above, under the plugin's prefix. */
const treeScopedRules = Object.fromEntries(
  Object.entries(TREE_SCOPED).map(([name, severity]) => [
    `${archPlugin.meta.name}/${name}`,
    severity,
  ]),
);

// ── the shipped rules this catalog does NOT enable ──────────────────────────
//
// oxlint bundles 847 rules — 14 plugins plus the unprefixed eslint core set — at
// no dependency cost. Each `arch/` rule was run head-to-head against the closest of
// them, on that rule's OWN spec fixtures, with a control proving the candidate was
// loaded. This block is the result: each shipped rule that speaks to a subject an
// `arch/` rule owns, and the line saying why it stays off. Absent a line, an
// adopter re-runs the search — and a rule missing from a config is
// indistinguishable from one nobody thought about.
//
// SCOPE, because the paragraph above is exactly the kind of claim this file asks to
// be checked. The head-to-head covers every tag, `types/` included. The `types/`
// half ran second and differently: those rules want type information, so their
// candidates are the 59 rules tsgolint implements, and the probe had to enable
// `typeAware` and write a real `tsconfig.json` beside every fixture — without
// either, all 59 report zero and every verdict reads as "covers nothing".
//
// It ran against the whole `typescript/` set rather than a shortlist: all 109 keys
// oxlint accepts under that plugin, on each rule's own fixtures. That is a superset
// of the typed 59, and oxlint REFUSES to start on a rule name it does not know, so
// a config that parses is a config where every named rule loaded.
//
// The structural tier's subjects are covered too, in their own section at the end.
// Those checks have no oxlint spec fixtures for a candidate to run against, so
// those lines are arguments from what each built-in reports on the shared fixture
// tree, not fixture-for-fixture verdicts like the rest.
//
// Nothing here is a taste verdict. In every case the built-in either misses a
// spelling ours reports, or reports something ours deliberately allows — usually
// the fix our own message prescribes, which is an edit loop rather than a second
// opinion.
//
// Two facts that shorten every search below. First, oxlint ships NO
// `no-restricted-syntax` and NO `import/no-restricted-paths`, so the AST-selector
// and the zone-glob escape hatches an adopter reaches for first do not exist here.
// Second, no shipped rule FOLDS `..` in a specifier before judging it — which cuts
// less far than it sounds, and the difference matters: a `**` glob still catches
// `@/shared/../infrastructure/db`, because it matches the unfolded string
// literally. It is the exact-specifier `paths` form and
// `import/no-relative-parent-imports` that miss it.
//
// THE RESTRICTED-* FAMILY, which is the generic form of about fifteen rules here.
// `no-restricted-imports`, `no-restricted-properties`, `no-restricted-globals` and
// `no-restricted-exports` are deliberately absent, together, for one reason worth
// stating once: they ban a NAME, and every rule in this catalog bans a name IN A
// POSITION. `no-restricted-globals` cannot exempt the env module that validates
// `process.env` — there is one rule id for the whole global set, so an override for
// that file also unbans `fetch` there. `no-restricted-properties` reads a member
// access, so it misses an object-literal KEY entirely (all 11 of
// `arch/no-disable-validation`'s violations) and bans `Effect.void` everywhere
// rather than in the catch-handler position. `no-restricted-imports` reads a static
// string specifier only: it DOES see `import x = require("stripe")` and
// `await import("stripe")` — more than its name suggests — but not a
// `require("stripe")` call and not a backtick specifier. Its exact-specifier
// `paths` form cannot name a directory, while its `patterns` form is
// gitignore-style, so a bare `stripe` matches any path segment named stripe,
// including the wrapper our own message tells the author to import.
//
// Several of them DO reach fixture parity — but only once `overrides.files` globs
// restate `isArchitectureExemptSourcePath` per rule, which is the copy the
// `overrides` block below forbids. That is the whole trade: the fence becomes a
// dozen globs an adopter widens, instead of one vocabulary table.
//
// ── health, naming, testing ──
// `no-inline-comments`, `capitalized-comments`: the only two shipped rules whose
//   subject is a comment at all, and neither measures one. Head to head on a file
//   holding an 82-word run plus a short trailing note, `no-inline-comments` reports
//   the trailing note and nothing else — position, and it fires on the case
//   `arch/no-long-comments` blesses — while `capitalized-comments` reports five
//   times on that one legal run, once per continuation line, for its casing.
//   Neither sees the essay. `max-lines` counts a FILE's lines, which is
//   `health/file-size`'s question; `multiline-comment-style`,
//   `line-comment-position` and `max-len` are not bundled at all.
// `id-denylist`, `id-match`, `id-length`: `id-denylist` compares the WHOLE
//   identifier, so it bans `data` and allows `InvoiceData` — it reports none of
//   `arch/no-vacant-symbol-names`' eleven violations. `id-match` cannot express the
//   question at all: oxlint compiles its pattern with the Rust regex crate, which
//   refuses look-around, and "ban these words" is inherently a negation.
//   `unicorn/prevent-abbreviations` and `camelcase` are not bundled at all.
// `jest/no-restricted-jest-methods`: the near miss of the whole catalog. Given our
//   three method names it matches `arch/no-module-mocking` on all 17 fixtures, with
//   our message text verbatim, and it beats ours on the namespace and aliased
//   spellings. It stays off because the swap moves the method list out of
//   fixture-guarded source into config: today dropping `unstable_mockModule` fails
//   a spec, afterwards it fails nothing. A name list is legal vocabulary when it
//   names the PROJECT's; this one names the rule's subject.
// The rest of the mocking catalogue — `vitest/no-restricted-vi-methods` (the same
//   rule under a second name, already drifted: no `unstable_mockModule` entry),
//   `jest/no-mocks-import` and `vitest/no-mocks-import` (only `__mocks__/`
//   imports), `jest/prefer-spy-on` and `vitest/prefer-spy-on`, and
//   `jest/no-untyped-mock-factory` (which has no vitest twin) — all rewrite or
//   narrow the mock ours asks you to delete.
//
// ── react ──
// `react/no-multi-comp`: finds the same second component and then reports the fix
//   ours prescribes — a compound component namespaced with `Object.assign`. Its one
//   option, `ignoreStateless`, silences every function component, violations
//   included.
// `react/only-export-components`: a fast-refresh question, not a findability one.
// The other twenty rules oxlint 1.79 split `react/react-compiler` into. That
//   nursery rule no longer exists as a config key — it was indivisible, and taking
//   its `EffectDerivationsOfState` claim once meant also taking `Purity`, which
//   reports a `setInterval` effect that derives nothing. The split is what made the
//   two enabled below reachable on their own; the remaining twenty are
//   compiler-bailout diagnostics, not architecture, and stay off.
// `react-hooks/exhaustive-deps` and `rules-of-hooks`: enable them as React
//   correctness rules if you want them; they replace nothing here. `exhaustive-deps`
//   sees exactly one async spelling, `useEffect(async () => …)`, and `rules-of-hooks`
//   sees none of `arch/no-async-effect`'s thirteen violations.
// `react/no-did-mount-set-state`, `react/no-did-update-set-state`: class lifecycle.
// `max-params`, `max-statements`, `max-lines-per-function`, `vue/max-props`: none
//   reports the number `arch/hook-count` and `arch/prop-count` report. A component
//   takes one parameter, so `max-params` never sees a props surface; the size rules
//   fire on the six-hook legal at any threshold that catches the seven-hook
//   violation; `vue/max-props` reads Vue SFCs only. `vue/max-props` is also the
//   precedent for a threshold being legal vocabulary — `maxProps` is its ONLY
//   option, a number and nothing else. The other three are not that precedent: each
//   pairs its `max` with a behaviour switch (`ignoreTopLevelFunctions`,
//   `countVoidThis`, `skipComments`), which is the shape the `max-lines` entry below
//   is rejected for.
//
// ── style ──
// `react/forbid-dom-props`, `react/forbid-component-props`: they ban a prop NAME;
//   `arch/no-inline-style-prop` bans the object LITERAL, so `style={styles.row}` —
//   the shape it asks for — passes ours and fails theirs, and the primitives-layer
//   exemption the header calls mandatory is unreachable without a glob.
// `react/style-prop-object`: asks the OPPOSITE question, and fired on none of that
//   rule's ten violations.
// `react/forbid-elements`: catches the raw tags, but has no notion of the
//   primitives layer or the root route, so it reports the two files whose job is to
//   write `<div>`.
// `no-magic-numbers`: a name collision with `arch/no-raw-primitives`, not a
//   candidate — zero fires on its 38 violations. Against `arch/no-inline-font-size`
//   it bans a VALUE wherever it sits, so it reports the token source that has to
//   write the scale and stays silent on `fontSize: "13px"` and on every JSX
//   attribute.
// `unicorn/import-style`, `nextjs/no-img-element`: import FORM, and one tag already
//   in `arch/no-raw-primitives`' element list without its exemptions.
//
// ── effect ──
// `unicorn/max-nested-calls`: a depth count over all calls, so at `max: 1` it fires
//   on the flat `App.pipe(Layer.provide(A), Layer.provide(B))` that
//   `arch/no-nested-layer-provide` exists to ask for.
// `typescript/no-unnecessary-type-arguments`: asks whether a type argument equals
//   its parameter's DEFAULT. A correct `sql<Invoice>` never does, so it is silent on
//   every fixture `arch/no-sql-type-parameter` owns.
// Effect's own tooling, READ FROM SOURCE rather than run — neither package is a
//   dependency here, and the language service is a TypeScript plugin oxlint cannot
//   host. `@effect/eslint-plugin` ships two rules (`dprint`,
//   `no-import-from-barrel-package`), neither in range. `@effect/language-service`
//   ships 77 diagnostics, and two are near neighbours worth knowing about rather
//   than replacements: `multipleEffectProvide` rewrites
//   `x.pipe(Effect.provide(A), Effect.provide(B))` into
//   `Effect.provide(Layer.mergeAll(A, B))` — the sequential shape
//   `arch/no-nested-layer-provide` asks FOR, though it matches `Effect.provide`
//   where ours reads `Layer.provide`, so the two do not currently collide; and
//   `effectSucceedWithVoid` normalises `Effect.succeed(undefined)` to `Effect.void`,
//   inside `arch/no-silent-error-swallow`'s void set. A project running the language
//   service should expect both, and neither removes a rule here.
//
// ── types ──
// SEVEN OF THIS TAG'S SUBJECTS RUN IN THE OTHER TIER, and the survey still belongs
// here because the question it answers is about a shipped OXLINT rule: does it
// replace ours. That question does not change when ours moves. The names below say
// which tier owns each — `arch/x` is a rule this config turns on, `types/x` with no
// prefix is a structural check in `structural/types/`.
//
// ONE FINDING RUNS THROUGH THIS WHOLE SECTION, so it is stated once. The typed
// built-ins keep prescribing `unknown` as the fix, and `unknown` in a declaration is
// what this tag bans. `no-explicit-any` says "Use `unknown` instead";
// `explicit-module-boundary-types` says "prefer `unknown` and narrow before use";
// `consistent-indexed-object-style` says "Use a record type such as
// `Record<string, unknown>`". Each of those sentences is a violation of
// `types/no-broad-parameters`, `types/no-unknown-returns` or `types/no-opaque-record`
// respectively, written out in the help text. They are not weaker versions of these
// rules; they are the step before them, and following them lands exactly on the code
// this tag reports. That is an edit loop, and it is why the overlap is only ever on
// the `any` spelling.
//
// `typescript/no-unsafe-type-assertion`: the strongest candidate in the catalog and
//   the only one that covers a `types/` subject outright. It reports all four
//   canonical `types/no-widen-then-assert` flows — through `unknown`, through `any`,
//   through `object`, through an open `Record` — on code that typechecks. It stays
//   off because it is a BAN on narrowing assertions with no hatch, and this catalog
//   deliberately took justify-over-ban there. It fires on `parsed as User` after a
//   `JSON.parse` — the parse boundary `types/no-widen-then-assert`'s own legal
//   fixture blesses and `arch/require-safety-comment` exists to permit WITH a stated
//   invariant — and on `el as HTMLElement`. Adding the `// SAFETY:` comment that
//   `arch/require-safety-comment`'s message asks for does not silence it, so the two
//   are not jointly actionable: the only edit clearing both is deleting the
//   assertion, which makes the catalog's one justify rule dead. Measured reach, on
//   typechecking code: every narrowing assertion reports; widening, `as const` and a
//   same-type assertion are silent.
// `no-unsafe-return`, `no-unsafe-argument`, `no-unsafe-assignment`, `no-unsafe-call`,
//   `no-unsafe-member-access` — ON in this config already, and NOT candidates. They
//   judge a VALUE of type `any` flowing somewhere; the `types/` rules judge a
//   DECLARATION that names a broad type. The two never meet: passing an `any` into
//   `function handle(payload: unknown)` is safe, so `no-unsafe-argument` is silent on
//   exactly the parameter `types/no-broad-parameters` reports. Both were run over
//   both rules' full fixture sets and scored 0 on every violation.
// `no-explicit-any`, `explicit-module-boundary-types`, `explicit-function-return-type`:
//   the `any` spelling only, on every rule in this tag — see the edit loop above. The
//   last two also report `types/no-unknown-returns`' legal fixture, the inferred
//   return it leaves to TypeScript on purpose.
// `consistent-indexed-object-style`: reports one of `types/no-opaque-record`'s two
//   spellings and prescribes the other, whichever way it is configured — at its
//   default it rewrites `{ [k: string]: unknown }` into `Record<string, unknown>`,
//   and with `"index-signature"` it rewrites it back. It has no opinion about the
//   VALUE, which is half the question.
// `no-redundant-type-constituents`: reports `type T = unknown | string` for
//   `types/no-unknown-type-aliases`, and the fix is to drop the other members,
//   leaving `type T = unknown` — the alias that rule is named for. Silent on the bare
//   alias and on an alias chain.
// `consistent-type-definitions`: reports the named type `types/no-opaque-record`'s
//   own message asks the author to write, because it prefers `interface`.
// `no-unnecessary-condition`: the near neighbour of `types/no-runtime-typeof`, and
//   the one rule here reachable in config but absent from `oxlint --print-config
//   -D all`. It asks whether a condition is statically DECIDED — always true, always
//   false — where ours asks whether the operand has a type at all. On
//   `typeof input === "string"` over `string | number` both are silent, and that
//   agreement is the design: `types/no-runtime-typeof` reads the operand through a
//   checker, so the narrowing of a union draws nothing — it is the correct code a
//   syntax-only reading of the same rule reports. What neither catches is the typo —
//   `typeof v === "sting"` is a comparison that is merely always false, not
//   statically decided. Control-verified loaded.
// NO CANDIDATE, and this is the load-bearing negative result: on a file holding the
//   canonical violations of `types/no-runtime-typeof`, all 109 `typescript/` rules
//   together report NOTHING. `types/no-opaque-record`'s headline
//   `Record<string, unknown>` also draws nothing from any of them, and neither does
//   `types/no-known-value-widening`'s `const handlers: Record<string, Handler> = {…}`.
//
// ── the structural tier's subjects ──
// `max-lines`: one threshold at one severity, and `overrides` REPLACES the entry
//   rather than layering a second — `health/file-size` ships two, so a file can be
//   finished and split in the same commit. It also lints tests and `.d.ts`, which the
//   shared exemption predicate skips, and `skipComments` is an off-switch for a check
//   whose claim is that every line counts.
// `import/no-cycle`: reports cycles between FILES, one finding per participating
//   file. `graph/domain-cycles` reports one finding per component, at the domain
//   directory — and a domain ring can close through two files that import nothing
//   back, where no file cycle exists at all.
// `import/max-dependencies`: counts a file's import statements; `graph/feature-deps`
//   counts distinct FEATURES one feature reaches.
// `oxc/no-barrel-file`: forbids barrels, which this catalog requires.
//   `naming/barrel-discoverability` governs what a barrel may SAY.
// `import/prefer-default-export`: argues the opposite of that check, which bans a
//   default export from a barrel because it leaves no name to search for.
//   `import/group-exports` and `import/exports-last` govern where export statements
//   sit in a file, which nothing here has an opinion about.
// `import/no-namespace`: bans `import * as ns`; the shape that check reports is
//   `export * as ns from`, which it never visits.
// `unicorn/filename-case`: judges CASING. `naming/test-file-mirror` asks whether a
//   test names a module that exists — and following the built-in's advice renames the
//   file to something that no longer reads as a test, so the finding disappears
//   without the test gaining a sibling.
// `import/no-relative-parent-imports`: bans every `../`, including the three
//   `boundary/import-policy` fixtures that stay inside their unit, and prescribes a
//   move the layer grammar forbids.
// `unicorn/no-empty-file`, `import/no-unassigned-import`: neither reads a function
//   body, which is `health/trampolines`' whole claim.
//
// NEGATIVE SPACE ON THE NEGATIVE SPACE: oxlint opens no CSS and no markdown —
// `oxlint -D all` on either reports "No files found to lint". So `style/css-tokens`,
// `style/shadow-source`, `style/token-equality` and `health/doc-budgets` have no
// zero-cost candidate by construction, and what follows was WEIGHED, NOT RUN — the
// packages are not dependencies here and installing them was out of scope.
//
// stylelint could plausibly own `style/css-tokens` alone. There is no built-in
// "must be `var(--token)`" rule; the routes are
// `declaration-property-value-allowed-list` or the third-party
// `stylelint-declaration-strict-value`, and BOTH take regexes as configuration — the
// predicate knob, handed to the adopter, plus two to four new packages. It cannot own
// the other two at all: `style/shadow-source` and `style/token-equality` report on
// `.tsx` style objects and JSX props, and every maintained CSS-in-JS syntax parses
// tagged template literals only. The object-literal stack that once did
// (`@stylelint/postcss-css-in-js`, `postcss-jsx`) is deprecated, and stylelint
// removed `processors` in v15.
//
// markdownlint cannot own `health/doc-budgets`: its nearest rule, MD013, is a
// per-LINE character limit, and there is no word-count rule and no ratchet — a
// ceiling that may only move down — anywhere in its index. vale and textlint govern
// prose style, not document size.

export default defineConfig({
  // One module, not one path per rule. It calls `definePlugin({ meta: { name },
  // rules })`; `meta.name` is the prefix every `arch/` key inherits, and this file
  // reads it from there rather than spelling it — rename the plugin and the keys
  // follow.
  //
  // A bare package name resolves out of node_modules, so an ESLint plugin joins the
  // same array rather than needing its own mechanism — `eslint-plugin-sonarjs`
  // registers under the `sonarjs/` prefix. `jsPlugins` is also an `overrides` key;
  // reach for that only to scope a plugin to a subtree.
  jsPlugins: [ARCH_PLUGIN_PATH, "eslint-plugin-sonarjs"],

  plugins: BUILTIN_PLUGINS,

  ignorePatterns: GENERATED_GLOBS,

  // `typeAware` needs the `oxlint-tsgolint` dev dependency. Without it oxlint
  // aborts — "Failed to find tsgolint executable", exit 1, nothing linted — so a
  // missing dependency is a loud failure, not a config that quietly does less.
  // (Checked against oxlint 1.77.0.)
  //
  // Type information reaches the built-in `typescript/*` rules and nothing else. JS
  // plugins get no type checker, so neither `arch/` nor `sonarjs/` becomes
  // type-aware: every rule in this catalog stays a syntactic question about one
  // file, and no amount of this flag changes that.
  //
  // Type-aware linting is slower, and this config pays it: one config, full safety,
  // nothing extra for CI to know about. If pre-commit ever outgrows the cost, the
  // escape hatch is a second config that `extends` this file and sets
  // `typeAware: false`, wired to the staged-file hook alone — a narrower profile of
  // one rule list, never a second rule list. Note the `extends` constraint on
  // `ARCH_PLUGIN_PATH` above: that is the arrangement it exists for.
  //
  // `reportUnusedDisableDirectives` is read from the ROOT config only; setting it in
  // a nested workspace config buys nothing.
  options: { typeAware: true, reportUnusedDisableDirectives: "warn" },

  // The built-in rules, on for every file in the repo. Every `arch/` key sits in the
  // tree-scoped `overrides` block below, with the rationale for the whole plugin.
  rules: {
    // NEGATIVE SPACE: `typescript/no-require-imports` is deliberately absent, and was
    // looked at rather than overlooked. It bans the CommonJS *form* — `require(…)`,
    // `require.resolve(…)`, `import x = require(…)` — everywhere, which is the
    // cheaper half of the same fence: `arch/import-policy` already reads all three
    // spellings and judges where each one LANDS. Turning the built-in on would make
    // those visitor arms dead code and trade a verdict about architecture for a
    // verdict about syntax, including on the files where a `require` is correct (a
    // config read at load time, a script). A rule banning CJS outright was proposed
    // and rejected on the same ground.
    //
    // A project that wants the form gone too should add it as a style decision and
    // say so — not as a substitute for the policy, which would then be enforcing
    // nothing about those specifiers.

    // ── testing: a test exercises the module it names ──
    // See `GLOBAL_ARCH_RULE` above for why this one rule is not tree-scoped.
    [`${archPlugin.meta.name}/${GLOBAL_ARCH_RULE}`]: "error",

    // The type-aware built-ins that earn the tsgolint dependency, and only those.
    // Naming them is not decoration: `typeAware` on its own runs some at warning
    // severity — a green exit 0 with the violation printed — and leaves the
    // no-unsafe-* family off entirely.
    //
    // A promise nobody awaited is the bug agent-written async code produces most, and
    // it surfaces as an unhandled rejection nowhere near the line that made it. The
    // no-unsafe-* family stops a single `any` at an untyped boundary from laundering
    // itself through the call graph as a real type.
    "typescript/await-thenable": "error",
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
    "typescript/no-unsafe-argument": "error",
    "typescript/no-unsafe-assignment": "error",
    "typescript/no-unsafe-call": "error",
    "typescript/no-unsafe-member-access": "error",
    "typescript/no-unsafe-return": "error",

    // Structural duplication and identity slips: both branches of an if/else
    // identical, a condition repeated in a chain, two functions with the same body.
    // This is the shape an agent leaves behind when it did not find the code path
    // that already existed and wrote a second one beside it.
    //
    // The duplication/identity subset only. sonarjs also ships style opinions, and
    // taste does not belong in a gate. Duplication too large for one rule's window is
    // jscpd's job — setup/jscpd.json.
    //
    // `sonarjs/cognitive-complexity` is deliberately NOT here, and it is the one
    // omission that is not about taste: `arch/cognitive-complexity` measures the same
    // thing with three subtractive adjustments, so the two disagree on exactly the
    // functions that were written well. Two rules speaking to one edge with different
    // numbers is the "one invariant, one owner" break the catalog names. Take one.
    // This catalog takes its own, and the reasons are in that rule's header.
    "sonarjs/duplicates-in-character-class": "error",
    "sonarjs/no-all-duplicated-branches": "error",
    "sonarjs/no-duplicate-in-composite": "error",
    "sonarjs/no-duplicate-test-title": "error",
    "sonarjs/no-duplicated-branches": "error",
    "sonarjs/no-identical-conditions": "error",
    "sonarjs/no-identical-expressions": "error",
    "sonarjs/no-identical-functions": "error",

    // ── health: a decision is readable ──
    //
    // THE CORE RULE ALONE, and `unicorn/no-nested-ternary` is deliberately NOT beside
    // it. MEASURED rather than read: on every spelling probed, each file unicorn
    // reports the core rule reports too, and the core rule reports four more. Unicorn
    // recognises exactly two shapes — a nesting written WITHOUT parentheses, and a
    // chain more than one level deep — so the ordinary `p ? 1 : (q ? 2 : 3)` is
    // silent under it. It is a strict subset, and a subset buys no coverage.
    //
    // It would also cost something. Unicorn's message says "add parentheses around
    // the nested ternary", and adding them does NOT clear the core rule — so an
    // author following one message lands on the other, and only one of the two fixes
    // terminates. That is the edit loop this catalog names in "one invariant, one
    // owner": two rules may speak to an edge only when they are JOINTLY ACTIONABLE.
    // These two are not, which decides it on posture as well as on coverage.
    //
    // NEGATIVE SPACE: this does not read the TEST position. `(a ? b : c) ? 1 : 2`
    // draws nothing, and unicorn would not have covered it either — verified through
    // the CLI against both.
    //
    // DEPTH 2 IS THE LIMIT, and it is NOT a threshold this project sets:
    // `{ "max": 2 }`, a bare `2` and `{ "depth": 3 }` are each rejected as invalid
    // configuration. This is the one number in the catalog an adopter cannot move,
    // and it is lower than the budget the catalog documented while it owned the rule.
    // A project wanting a third level argues it in review; there is no knob.
    //
    // It also reports the chain extracted to its own binding, which is the refactor
    // the message asks for — so the fix is to name the branches, not to move them.
    "no-nested-ternary": "error",

    // ── react: state is derived, not synchronised in an effect ──
    //
    // BOTH again, and this pair is the less obvious one. `no-deriving-state-in-effects`
    // sounds like the whole claim and is not: it reports only where it can name the
    // reactive value the state was derived FROM, so `setTotal(sum)` — the same
    // derivation routed through a binding declared in the effect — draws nothing from
    // it, and neither does `setReady(true)` on mount. `set-state-in-effect` reports
    // both, so it is the rule doing the work and the one to keep if only one could
    // stay. Together they are what oxlint 1.79 exposed when it split
    // `react/react-compiler`; before that split neither was reachable without the
    // compiler's purity diagnostics.
    //
    // Both read every source extension, `.ts` included, so the `use*.ts` hook module
    // this catalog asks you to extract stays covered — which the `react/` folder's
    // own rules, gated on JSX extensions, do not manage.
    //
    // NEGATIVE SPACE: a setter called through a helper DECLARED INSIDE the effect
    // callback draws nothing from either — verified through the CLI, not assumed. No
    // rule in this catalog reads that shape, and no run will say so.
    "react/set-state-in-effect": "error",
    "react/no-deriving-state-in-effects": "error",
  },

  overrides: [
    // ── the declared trees ──────────────────────────────────────────────────
    //
    // Every `arch/` rule is scoped HERE, to the source roots this project declared in
    // `lint/policy/declared-trees.ts` — and `TREE_GLOBS` is computed from that list
    // rather than transcribed from it, so the two cannot disagree. A monorepo needs
    // no edit: declare the second root and its glob appears.
    //
    // The alternative arrangement is a nested config inside each workspace that
    // `extends` this file — same scoping, expressed as file placement instead of a
    // glob. Nested configs load automatically; `--disable-nested-config` turns that
    // off. Either way the declaration list stays the source of truth.
    //
    // NEGATIVE SPACE, and setup docs say it too: a tree not declared is a tree this
    // project did not adopt for. The rules are silent there — no findings, no
    // "unclassified" diagnostic — and that silence is not coverage. Adding a package
    // without adding its root leaves it unpoliced, and nothing says so.
    //
    // The scoping is belt AND braces: every rule named here also resolves the file it
    // is handed against the declared trees and returns early outside them, so a
    // project that reaches oxlint some other way still gets the same silence. The
    // globs are what keep those rules from being loaded for files they will never
    // report on.
    //
    // `typescript/` and `sonarjs/` stay GLOBAL above. They are questions about a
    // file — an unawaited promise, two identical branches — not about a position in
    // an architecture, and a config file or a script wants them just as much.
    //
    // A project turning one `arch/` rule off for a subtree of a declared tree is the
    // menu this catalog exists to refuse. Where an exception is an architectural
    // FACT — a generated file, a test — it belongs in
    // `isArchitectureExemptSourcePath`, which both tiers read.
    {
      files: TREE_GLOBS,
      rules: treeScopedRules,
    },

    // ── the architecture exemption, restated for four built-ins ─────────────
    //
    // ONE entry carrying four rule keys, not four entries. The four rules below
    // replaced two `arch/` rules, and an `arch/` rule asks
    // `isArchitectureExemptSourcePath` before it matches anything. A built-in cannot:
    // it has never heard of the predicate, so a test file that was silent yesterday
    // reports today unless this block says otherwise.
    //
    // These globs are a TRANSCRIPTION of that predicate, not a policy of their own,
    // and the transcription is what makes them legal here rather than the off-switch
    // the block above refuses. Each line names a structural fact the predicate reads:
    // a `.test` suffix under any source extension (the extension list is stripped
    // before the suffix is matched, so `.test.mts` counts and a regex spelling
    // `[tj]sx?` would miss it), a `__tests__` directory anywhere, the cross-cutting
    // `test/` directory at the root of the frame, a `.d` or `.gen` name, and any
    // segment named `scripts`. The three brace lists are `SOURCE_EXTENSIONS` from
    // `lint/policy/layout.ts` written out, and they move when it does. Growing this
    // list past what the predicate computes is the menu; shrinking it re-reports code
    // the catalog exempts everywhere else.
    //
    // `generatedDir` is deliberately ABSENT even though the predicate reads it:
    // `ignorePatterns` above already spells it for the built-ins, computed from the
    // tree list. A second copy here is the one policy in two places this catalog most
    // reliably drifts.
    //
    // ONE ENTRY, because `overrides` REPLACES a matching entry rather than layering —
    // the same mechanic the `max-lines` note above turns down. Four entries would be
    // four glob lists to keep equal to each other and to the predicate.
    {
      files: [
        "**/*.test.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
        "**/__tests__/**",
        "test/**",
        "**/*.d.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
        "**/*.gen.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
        "**/scripts/**",
      ],
      rules: {
        "no-nested-ternary": "off",
        "react/set-state-in-effect": "off",
        "react/no-deriving-state-in-effects": "off",
      },
    },
  ],
});

// ── the load-time assertion ─────────────────────────────────────────────────
//
// The type table above is the real guard and this is its runtime twin, for the
// project that never adds this file to a program. It closes the omission half of
// the registration/activation split: a rule the plugin exports and neither block
// names used to be loaded and never run — no warning, no output, exit 0.
//
// It throws rather than warns, and at config load, which is the loudest moment
// available. A rule silently not running is the failure this whole file is
// arranged against; refusing to start is strictly better than linting with a gap.
{
  const named = new Set([...Object.keys(TREE_SCOPED), GLOBAL_ARCH_RULE]);
  const exported = Object.keys(archPlugin.rules);
  const unnamed = exported.filter((name) => !named.has(name));
  const unknown = [...named].filter((name) => !exported.includes(name));
  if (unnamed.length > 0 || unknown.length > 0) {
    throw new Error(
      `oxlint.config.ts and lint/oxlint/plugin.ts disagree about the rule list. ` +
        `Registered but never enabled (loaded, silent, exit 0): ${unnamed.join(", ") || "none"}. ` +
        `Enabled but not exported (oxlint refuses the whole config): ${unknown.join(", ") || "none"}. ` +
        `Both blocks are derived from the plugin — reconcile the severity table, ` +
        `do not widen this check.`,
    );
  }
}
