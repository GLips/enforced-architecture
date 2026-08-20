# boundary — Layer direction and import restrictions

The whole-tree half. Both checks consume the resolved import graph rather than matching specifier
text, which is what lets them see an edge no spelling can hide. The per-file rules are in
[../../oxlint/boundary/overview.md](../../oxlint/boundary/overview.md).

`import-policy` is the one to take first, and it is half of a rule rather than a whole one: the
oxlint adapter judges aliased specifiers and bare packages, this one judges resolved relative edges,
and both hand the same string to the same table. Taking one without the other leaves every verdict
true of one spelling only.

| Rule | Blocking | What it prevents |
|---|---|---|
| [import-policy](import-policy.md) | Yes | Relative imports the policy denies, and permitted crossings written relatively — a bypass for every rule that matches the aliased path. Consumes the import graph |
| [layer-occupancy](layer-occupancy.md) | Yes | Bypassing an OCCUPIED layer inside one feature — any source layer, any skipped layer, type imports included (e.g., `ui/` importing `service/` while `controllers/` holds code) |

Adoption mechanics, the spec contract, and cross-tag rule selection: [../../overview.md](../../overview.md).
