# naming — Searchability and discoverability

The whole-tree half: both checks compare a name against something outside the file that carries it
— a barrel's re-export against the symbol it renames, a test filename against the source it should
mirror. The per-file half is in [../../oxlint/naming/overview.md](../../oxlint/naming/overview.md).

| Rule | Blocking | What it buys |
|---|---|---|
| [barrel-discoverability](barrel-discoverability.ts) | Yes | Every barrel of a subdivided unit lists each name it exports, under the name the definition has |
| [test-file-mirror](test-file-mirror.ts) | No | The tests that a search for their source module does not find |

`barrel-discoverability` reads the barrel of each unit under the tree's subdivided directories,
spelled the way that tree spells barrels, so a project with no public barrels gets no findings from
it. Every question it asks is decidable from one file. It stays
a structural check because it uses the same file walk as `test-file-mirror`. The finding thus comes
at commit time and not in the editor. Move it to the lint tier to get the finding at author time;
the intent does not change.

`test-file-mirror` reads only tests that sit beside the code they cover. A project that keeps its
tests in a separate tree gets one warning for each test file. A check that reports every file is a
check the project turns off. Both of its findings have severity `warning`, and the severity is in
the code, not in the config. A project with a fully co-located test layout can change the two values
to `error`.

Adoption mechanics, the spec contract, and what part of the tree owns each rule's subject: [../../overview.md](../../overview.md).
