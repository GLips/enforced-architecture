# Documentation Model

What to document beyond mechanical enforcement, where to put it, and why it matters.

---

## Why Document Beyond Enforcement

Mechanical enforcement (GritQL rules + structural scripts) catches violations after code is written. Documentation guides agents to make correct decisions before writing code. The gap matters:

- An agent that doesn't know when to add a service layer will either scaffold one prematurely or skip one when orchestration arrives.
- An agent that doesn't know the re-export pattern will create trampolines when layers are required.
- An agent that doesn't know the barrel convention will put server-only exports in the wrong barrel.

Enforcement is the safety net. Documentation is the guardrail.

---

## Configurable Choice: Documentation Depth

Surface this choice during Phase 2 alongside the other architectural choices.

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
| **Server/client file naming** | Why `createServerFn` files must NOT use `.server.ts`. |
| **Controller file naming** | Named without `.server.ts`, re-exported through `index.ts`. |
| **Route imports** | Import from `@/features/<name>`, not deep paths. |
| **Server function naming** | The `Fn` suffix convention (or project-specific convention). |
| **Test placement** | Co-located `thing.test.ts` next to `thing.ts`. |

### Conditional content

Include based on which architectural choices were made:

| Choice | Content to add |
|---|---|
| **Layered features** | Layer ordering (`ui/ → controllers/ → service/ → repo/`), occupancy rules (skip absent, never bypass present), graduation triggers (when to add each layer), re-export pattern for maintaining layer contracts without trampolines. |
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
- **Acknowledge enforcement exists.** Frame CLAUDE.md so agents know they don't need to memorize every rule — the linter will catch violations. Something like "Violations are caught by lint rules and CI checks — the linter will stop you, so focus on knowing where things live." This reduces agent anxiety about getting things wrong and focuses them on the decision that matters (placement), not rote memorization of every boundary rule.

---

## docs/architecture/ Content

Expanded reference material for structural decisions. Agents read this when designing new features, adding layers, or resolving architectural questions. Unlike CLAUDE.md, this can include rationale, examples, and trade-off analysis.

Organize as individual files, not one monolith. Each file covers one concern and can be referenced from CLAUDE.md via a "read when" table.

### Recommended files

| File | Content | Read when |
|---|---|---|
| `feature-patterns.md` | Feature scaling tiers (small/standard/complex) with concrete examples from the project. Graduation triggers. Layer responsibilities. | Adding a new feature or graduating an existing one. |
| `import-boundaries.md` | Full import boundary matrix. Which layers can import what, with rationale for each cell. Cross-feature import rules. | Unclear whether an import is allowed. |
| `server-client-boundaries.md` | Bundle splitting conventions. What `.server.ts` means. The two-file split escape hatch. How `createServerFn` compilation works. | Working with server/client code splitting. |
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

## Generating Documentation During Implementation

Documentation generation is part of Phase 4 (implementation), not a separate phase. The implementing agent has all the context from the plan document — the documentation distills that context into the appropriate format.

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
| [feature-patterns.md](docs/architecture/feature-patterns.md) | Adding or graduating a feature |
| [import-boundaries.md](docs/architecture/import-boundaries.md) | Unclear whether an import is allowed |
| [how-to/new-feature.md](docs/architecture/how-to/new-feature.md) | Creating a new feature from scratch |
| [how-to/new-infra-adapter.md](docs/architecture/how-to/new-infra-adapter.md) | Integrating a new third-party service |
```

This keeps CLAUDE.md terse while giving agents a path to deeper information. How-to guides are especially valuable — agents follow procedures more reliably than they synthesize behavior from reference material.
