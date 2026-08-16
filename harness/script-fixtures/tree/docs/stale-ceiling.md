# Decisions

Which configurable choices this tree made, and why. One paragraph each; the
plan document carries the alternatives that lost.

**Layered features.** Controllers, service, repo, ui, in that order. The order is
the only thing enforcement can read, so it is the thing written down.

**Domains layer.** Rules that outlive any one feature live in `domains/` and stay
pure, which is what makes them testable without a database.
