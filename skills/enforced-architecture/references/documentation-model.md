# Documentation Model

What to document beyond mechanical enforcement, where to put it, and why it matters.

---

## Why Document Beyond Enforcement

Mechanical enforcement catches violations after code is written; documentation shapes the decision before it. The gap is every judgment a rule cannot make — when a service layer is warranted, when a layer would be a trampoline, which barrel an export belongs in. Enforcement is the safety net. Documentation is the guardrail.

---

## Configurable Choice: Documentation Depth

| Option | What gets generated |
|---|---|
| **CLAUDE.md only** | A "Rules of the Road" section in CLAUDE.md with terse, decision-ready rules. Sufficient for small projects where the architecture is simple enough to fit in a screenful. |
| **CLAUDE.md + docs/architecture/** | CLAUDE.md gets the terse rules. `docs/architecture/` gets expanded reference material with rationale, examples, and boundary matrices. Better for projects with layered features, multiple domains, or complex server/client boundaries. |

**Recommendation:** Use both when the project has layered features or a domains layer. The CLAUDE.md section stays short (agents read it on every task), while docs/architecture/ provides depth when agents are designing new features or making structural decisions.

---

## CLAUDE.md Content

The CLAUDE.md section should be terse, imperative, and decision-ready. An agent should be able to read it in under a minute and know how to place code correctly.

### Required content

Always include, regardless of architectural choices:

| Category | Content |
|---|---|
| **Commands** | Build, test, lint, format, typecheck, migrations. Copy-pasteable. |
| **Dependency direction** | The fundamental invariant and the layer ordering. |
| **Feature barrel convention** | `index.ts` vs `index.server.ts`, what goes in each, barrel direction rule. |
| **Server/client file naming** | `createServerFn` definitions use plain `.ts`; raw server-only helpers use `.server.ts`. |
| **Controller file naming** | Keep RPC definitions client-importable and re-export them through `index.ts`. |
| **Route imports** | Import from `@/features/<name>`, not deep paths. |
| **Server function naming** | The `Fn` suffix convention (or project-specific convention). |
| **Test placement** | Co-located `thing.test.ts` next to `thing.ts`. |

### Conditional content

Include based on which architectural choices were made:

| Choice | Content to add |
|---|---|
| **Layered features** | Layer ordering (`ui/ → controllers/ → service/ → repo/`), directory-wide repo/service occupancy at the controller edge, graduation triggers, and re-export patterns. |
| **Domains layer** | Purity constraint (no side effects, no infrastructure imports), how controllers wire domain functions to infrastructure. |
| **Error convention** | Single class with typed codes per feature, or per-layer errors. Include a code example. |
| **SDK containment** | Procedure for adding new SDKs: wrap in `infrastructure/`, add to containment rule, add to barrel-purity patterns if needed. |
| **Extraction threshold** | The number (typically 3) at which shared code is promoted to `shared/`. |

### Anti-patterns to document

These are semantic rules that enforcement can't fully catch. Include any that apply:

| Rule | Why it can't be enforced mechanically |
|---|---|
| **No trampolines** | The heuristic checker is warning-only; false positives exist. |
| **Don't abstract `createServerFn`** | The failure mode (factory functions wrapping createServerFn) is too varied for pattern matching. |
| **Extraction threshold** | Requires counting usage across features — possible but brittle. |
| **No scaffolding empty directories** | Directory creation isn't an import pattern; it's a filesystem operation. |

### Tone guidance

- Imperative voice: "Features use X" not "Features should use X."
- No rationale in CLAUDE.md — save that for docs/architecture/. Agents need rules, not persuasion.
- Include code examples only for conventions that aren't obvious from the rule statement (e.g., error class pattern, re-export syntax).
- **Acknowledge enforcement exists.** Tell agents that lint and CI catch violations.

---

## docs/architecture/ Content

Expanded reference material for structural decisions. Agents read this when designing new features, adding layers, or resolving architectural questions. Unlike CLAUDE.md, this can include rationale, examples, and trade-off analysis.

Organize as individual files, not one monolith. Each file covers one concern and can be referenced from CLAUDE.md via a "read when" table.

### Recommended files

| File | Content | Read when |
|---|---|---|
| `feature-patterns.md` | Feature scaling tiers (small/standard/complex) with concrete examples from the project. Graduation triggers. Layer responsibilities. | Adding a new feature or graduating an existing one. |
| `import-boundaries.md` | Full import boundary matrix. Which layers can import what, with rationale for each cell. Cross-feature import rules. | Unclear whether an import is allowed. |
| `server-client-boundaries.md` | Bundle splitting conventions. What `.server.ts` means. The two-file split. How `createServerFn` compilation works. | Working with server/client code splitting. |
| `error-conventions.md` | Error architecture rationale. How controllers map error codes to HTTP status. Examples. | Adding error handling to a feature. |
| `decisions.md` | Which configurable choices were made and why. Links back to the original plan document. | Understanding why the architecture is shaped the way it is. |

**Alternative organization:** The per-concern split above works well at scale. For smaller projects, a two-file split also works: `reference.md` (what is the structure — boundaries, layers, rules) and `conventions.md` (how to write code within it — error patterns, barrel conventions, SDK adapter procedure). Choose whichever keeps individual files under ~200 lines.

### How-to guides

Step-by-step procedures for common structural tasks. These serve a different purpose than reference docs — an agent follows them as a checklist rather than reading for understanding.

Place in `docs/architecture/how-to/`. Each guide covers one task and ends with a verification checklist.

| Guide | Content | Use when |
|---|---|---|
| `new-feature.md` | Minimum viable feature structure, how to add each layer, barrel setup, error types, checklist. | Creating a new feature from scratch. |
| `new-infra-adapter.md` | Adapter placement, SDK containment rule update, env var setup, client-safe exceptions, checklist. | Integrating a new third-party service. |

Add project-specific how-to guides as patterns emerge. Good candidates: adding a new domain module, promoting feature code to shared, graduating a feature from one tier to the next.

### What NOT to put in docs/architecture/

- Rule implementation details (those live in the rules themselves and the EA skill templates).
- Commands and quick-reference material (that's CLAUDE.md).
- Domain-specific business logic documentation (that belongs in feature READMEs or domain docs).

---

## Word Budgets

Everything above is a doc agents read while deciding where code goes — and therefore a doc agents keep appending to. Each addition is defensible on its own: a clarifying paragraph, a worked example, a note about the case that just came up. Nothing is ever removed. The CLAUDE.md section written to be read in under a minute becomes the one that is skimmed, and the reference file written to be consulted becomes the one that is grepped and abandoned.

Nothing in the enforcement tiers notices, because length is not a violation of anything. So budget it: `docs/doc-budgets.manifest.json` maps each standing doc to a word ceiling, and [health/doc-budgets](lint/structural/health/doc-budgets.ts) fails the build on two conditions rather than one.

- **Over the ceiling.** The doc has to be condensed, or the material moved to the doc that owns it.
- **More than 5% of slack under the ceiling.** This is the ratchet, and it is the half that does the work. A doc that gets condensed otherwise leaves its old ceiling behind, and that headroom is room the next agent expands into with nothing to show in a diff. Reclaiming it in the same change costs one number and puts it in the hands of the person who just did the shortening.

A ceiling therefore only ever moves down by itself. Raising one is possible and deliberately conspicuous: a line in the manifest, in the commit that needed the room, carrying the reason it was needed. That is the entire mechanism — no check can tell dense prose from filler, and the budget does not try. It forces the trade to be made by someone rather than deferred forever.

**Budget the standing docs only.** CLAUDE.md and the `docs/architecture/` files, because those are read on every task and their length has a per-task cost. Plans, ADRs, changelogs, and feature READMEs are written once and appended to by design; a ceiling on them is friction that buys nothing. Set the first ceilings from what the docs already weigh — the rule's *Adapt* section has the command.

---

## Generating Documentation During Implementation

Documentation is generated by the implementing agent, from the plan document, once the rules and directory structure are in place — not as a phase of its own.

### Sequence

1. After enforcement rules and directory structure are in place, generate CLAUDE.md content.
2. If docs/architecture/ was chosen, generate those files next.
3. Verify: read the generated CLAUDE.md as if you were an agent encountering the project for the first time. Can you answer "where does this code go?" for any type of work?

### CLAUDE.md integration

If CLAUDE.md already exists, add the architectural rules as a new section (typically "Rules of the Road" or "Architecture"). Do not overwrite existing content (commands, project description, etc.).

If CLAUDE.md does not exist, create it with commands and architecture sections. The `/claudemd` skill can generate the commands section; the architecture section comes from this process.

### Cross-referencing

CLAUDE.md should include a table or list pointing to docs/architecture/ files:

```markdown
| Doc | Read when |
|-----|-----------|
| `docs/architecture/feature-patterns.md` | Adding or graduating a feature |
| `docs/architecture/import-boundaries.md` | Unclear whether an import is allowed |
| `docs/architecture/how-to/new-feature.md` | Creating a new feature from scratch |
| `docs/architecture/how-to/new-infra-adapter.md` | Integrating a new third-party service |
```

This keeps CLAUDE.md terse while giving agents a path to deeper information. How-to guides are especially valuable — agents follow procedures more reliably than they synthesize behavior from reference material.
