# Import boundaries

The matrix, one row per layer, read as "may import".

| Layer | May import |
|---|---|
| ui | controllers, shared |
| controllers | service, domains, shared |
| service | repo, domains, shared |
| repo | infrastructure, domains |

Cross-feature imports go through the other feature's barrel and nowhere else.
Anything deeper is a path the barrel never promised to keep.
