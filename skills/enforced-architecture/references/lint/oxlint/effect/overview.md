# effect — Effect-TS policy bans

Rules for projects built on Effect. They are the smaller half of the enforcement story: read the next section before adopting any of them, because the tier that catches the *interesting* Effect defects is not a linter at all.

## @effect/language-service is step zero

Almost every Effect mistake worth catching is a question about types. Is this expression an un-awaited Effect that nobody ran? Does this `catch` handle an error the effect cannot produce? Does this `Effect.gen` contain a `try/catch` that will never see an Effect failure? No syntactic rule — oxlint, ESLint, or anything else in this catalog — can answer those, because the answer is in the checker, not the tree.

`@effect/language-service` can. It is a TypeScript language-service plugin, configured in `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@effect/language-service",
        "diagnosticSeverity": {
          "floatingEffect": "error",
          "catchUnfailableEffect": "error",
          "missingEffectError": "error",
          "tryCatchInEffectGen": "error",
          "strictBooleanExpressions": "error"
        }
      }
    ]
  }
}
```

The `diagnosticSeverity` map is the whole adoption surface: each diagnostic is set by name to `off`, `error`, `warning`, `message`, or `suggestion`. Real projects run this hard — mikearnaldi's accountability repo, the source of the rules below, names roughly forty diagnostics in that map, 26 of them at `error` and the rest at `warning`.

**The gotcha that decides whether any of it is real: LSP plugins load only in editors.** Plain `tsc` ignores `compilerOptions.plugins` entirely, so a repo configured as above has zero Effect diagnostics in CI — everything is green on the build server and red in one contributor's editor, which is the worst arrangement available. The CLI closes it two ways. The lighter one runs the diagnostics against a project without touching the compiler:

```
effect-language-service diagnostics   # report the diagnostics for a project
effect-language-service check         # the same, as a pass/fail gate
```

The heavier one makes plain `tsc` raise them, which is the recommendation — a gate nobody has to remember to call:

```jsonc
{
  "scripts": {
    "prepare": "effect-language-service patch"
  }
}
```

`effect-language-service patch` patches the local `node_modules/typescript` (`typescript.js` and `_tsc.js`) so `tsc` itself raises the Effect diagnostics at build time, including under `noEmit`, `composite`, and `incremental`. Putting it in `prepare` re-applies it after every install, which matters because a fresh `node_modules` silently reverts to an unpatched compiler — and an unpatched compiler does not fail, it just stops reporting. `ignoreEffectWarningsInTscExitCode` (default `false`) decides whether warning-severity diagnostics affect the exit code. On TypeScript 7.0+, use `@effect/tsgo` instead of patching.

**The division of labour, stated plainly:** the language service owns everything type-aware. The rules here own syntactic policy — bans on named APIs and shapes, where the violation is visible in the source text and the decision is a project's, not the type checker's. Adopt the language service first. These rules are what it leaves on the table.

## Rules

The last column is the tag each rule would sit in if it were not Effect-specific — the catalog's mental model, for readers who know the other tags.

| Rule | Blocking | What it prevents | Tag if not Effect |
|---|---|---|---|
| [no-disable-validation](no-disable-validation.ts) | Yes | `{ disableValidation: true }` on a Schema constructor — and the shorthand, quoted, computed, and forwarded-flag spellings of it | placement |
| [no-silent-error-swallow](no-silent-error-swallow.ts) | Yes | A catch handler whose body is `Effect.void`, in either the data-first or the data-last spelling, including the `catchTags` object form | testing |
| [no-effect-catchallcause](no-effect-catchallcause.ts) | Yes | `Effect.catchAllCause` and `Effect.catchAllDefect` — handling a bug as if it were an expected failure | boundary |
| [no-service-option](no-service-option.ts) | Yes | `Effect.serviceOption`, which turns a missing layer from a compile error into a quiet runtime `None` | boundary |
| [no-nested-layer-provide](no-nested-layer-provide.ts) | Yes | `Layer.provide` nested anywhere inside another `Layer.provide`'s arguments, including through `.pipe(…)` | health |
| [no-sql-type-parameter](no-sql-type-parameter.ts) | Yes | ``sql<Row>`…` `` — a row shape declared and never checked. Use `SqlSchema` with a `Schema` | types |

Two of them are one catalog idea in Effect clothing:

- **`no-disable-validation` is the opt-out half of a mandate.** Any rule requiring validation is satisfied by a validator call that validates nothing, so the mandate and the ban on its no-op form have to ship together — `placement/server-fn-validation` is the mandate half at a different boundary.
- **`no-sql-type-parameter` overlaps `types/no-type-argument-assertion`**, which lists `sql` among its asserting calls. Adopting both double-reports every typed query. Take both and drop `"sql"` from that rule's name set, so each line raises the message naming the fix its own tag would ask for.

## What was deliberately not ported

The source config carries five more rules. They are absent on purpose, and re-deriving them later is wasted work:

- **`no-effect-asvoid`** — a ban on `Effect.asVoid`, which discards the *success* value and leaves the error channel untouched. Nothing is hidden by it; whether the value was worth keeping is a design question, not a rule.
- **`no-effect-ignore`** — a ban on `Effect.ignore`, which discards the *errors*. That is a real concern, and it is the same concern as `no-silent-error-swallow` in the table above — but answering it well means knowing which errors are being discarded and whether any of them were declared, which is the type-aware tier's question. `@effect/language-service` answers it better than a name ban can.
- **`prefer-option-from-nullable`** and **`pipe-max-arguments`** — formatting preferences. A rule that fires on working, readable code buys ignored diagnostics.
- **`no-void-expression`** is actively harmful and would be worth removing from a project that has it. `void somePromise` is the standard marker for a deliberately un-awaited promise — the thing `no-floating-promises` and every reviewer look for. Banning it does not remove floating promises; it removes the annotation that says a given one was intended, leaving the codebase with the same promises and no way to tell deliberate from forgotten.

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
