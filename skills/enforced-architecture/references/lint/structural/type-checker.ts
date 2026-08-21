// ─── The tier's type checker ──────────────────────────────────────────
//
// One TypeScript process for the whole run, and one `Project` per declared tree.
// Every check that asks a question about a TYPE rather than about a path or a
// specifier reads its answers through here.
//
// This is the second substrate in this tier, beside `import-graph.ts`. The split
// between them is the same one that puts a rule in a tier at all: the graph
// answers where a specifier LANDS, and this answers what a declaration MEANS.
// Neither can answer the other's question, and a check reaching for the wrong
// one gets a confident wrong answer rather than an error.
//
// ── Why the async API, which is not a preference ──────────────────────
//
// TypeScript 7 ships two clients for the same server. `typescript/unstable/sync`
// reads `child.stdout._handle.fd`, a Node internal Bun does not expose, and
// throws inside the `API` constructor — this tier runs under Bun, so that door
// is shut, not slower. `typescript/unstable/async` works under both runtimes.
//
// That is why `StructuralCheck.run` returns a promise even for the checks that
// never await anything. One shape for every check is worth more than sixteen
// signatures that each say whether their body happens to need a round trip: a
// union return type is one forgotten `await` away from a check whose findings
// arrive as a pending promise and count as none.
//
// ── Why `unstable` in the import path is an accepted cost ─────────────
//
// It is the only door. TypeScript 7's main entry exports `version` and
// `versionMajorMinor`; `ts.createProgram` is gone. A project on TypeScript 5
// would need the classic in-process API, which is a SECOND implementation of one
// question — the defect this catalog most reliably produces. So the tier takes
// the TypeScript 7 generation and says so, rather than carrying both.
//
// The bet is mostly already placed elsewhere: the shipped `.oxlintrc.json` turns
// on `typeAware`, which needs `oxlint-tsgolint`, which IS TypeScript 7's checker.
// What is new here is the version floor on the `typescript` package itself.
//
// ── Cost, measured rather than assumed ────────────────────────────────
//
// Round trips dominate, not type checking. On a synthetic 2,000-file tree the
// snapshot costs ~80ms and the scan ~490ms across ~8,100 requests; `tsc --noEmit`
// over the same tree is ~180ms. So the two things worth doing are asking in
// BATCHES (`getTypeAtLocation` takes an array) and asking once per distinct TYPE
// rather than once per node — `typeFacts` below is that cache, and it halves the
// request count on the same tree.
//
// ── Negative space ────────────────────────────────────────────────────
//
// - Nothing here observes the filesystem, and there is deliberately no
//   invalidation API. A host lives for ONE run over one snapshot, and
//   `disposeTypeCheckerHost()` ends it; a watch loop takes a fresh host. An
//   invalidation call no run makes is a call nothing proves, and the failure mode
//   it has is the quiet one — the wrong request shape is accepted, invalidates
//   nothing, and every re-run answers from the stale program with better timings.
// - A tree whose `tsconfig` misses files the tree contains is not detected here
//   — `assertTreeIsTypeChecked` in `check-substrate.ts` owns that, because it is
//   a question about the AGREEMENT between two declarations rather than about
//   either one.
// - There is no `.js` story. The program is whatever the tsconfig says, and a
//   tree of JavaScript gets whatever `allowJs` gives it.
// ──────────────────────────────────────────────────────────────────────

import { resolve } from "node:path";
import { API, TypeFlags } from "typescript/unstable/async";
import type {
  Checker,
  IndexInfo,
  Program,
  Snapshot,
  Symbol as TypeCheckerSymbol,
  Type,
} from "typescript/unstable/async";
import { NodeFlags, SyntaxKind } from "typescript/unstable/ast";
import type { Node, SourceFile } from "typescript/unstable/ast";
import type { DeclaredTree } from "../policy/declared-trees.ts";

// The `unstable` import path is in THIS FILE and no other. Every `types/` check
// reads the compiler's own vocabulary — `Type`, `Checker`, `SyntaxKind` — through
// these re-exports, which is not indirection for its own sake: the day that path
// changes, it changes in one place instead of seven, and nothing has to be
// renamed for it.
//
// Re-exported RATHER THAN wrapped, deliberately. An earlier cut of this file put
// a façade in front of the checker — `typesAt`, `unionMembersOf`, `symbolNameOf`
// — and it was a second vocabulary for the same questions, one method wide,
// growing by one every time a check needed something the façade's author had not
// anticipated. The checker's API is already documented, already exhaustive, and
// already the thing every reader knows; naming half of it again is the
// two-answers-to-one-question defect wearing an abstraction.
export { NodeFlags, SyntaxKind, TypeFlags };
export type { Checker, IndexInfo, Node, Program, SourceFile, Type, TypeCheckerSymbol };

/**
 * One file's identity as the PROGRAM spells it, for comparing two paths that came
 * out of different program APIs.
 *
 * `SourceFile.fileName` preserves the case on disk; a declaration handle's `path`
 * is the compiler's canonical form, which on a case-insensitive filesystem is
 * lowercased. Comparing them raw answers "not the same file" for every
 * declaration in a repo whose path has a capital letter — silently, and in the
 * direction that reports rather than the one that hides, which is why it took a
 * fixture count to notice.
 */
export function programPathKey(fileName: string): string {
  return fileName.toLowerCase();
}

/** `programPathKey` over a set of file names. */
export function programPathKeys(fileNames: Iterable<string>): ReadonlySet<string> {
  return new Set([...fileNames].map(programPathKey));
}

/**
 * What a check gets: one tree's program and checker, plus the one cache worth
 * sharing across checks.
 */
export type TreeTypeChecker = {
  program: Program;
  checker: Checker;
  /** Absolute paths of every file in this tree's program, `node_modules` included. */
  sourceFileNames(): Promise<readonly string[]>;
  /**
   * `checker.getIndexInfosOfType`, memoised by type ID for the life of the run.
   *
   * The memo is on the TYPE and not on the node, which is where the saving is:
   * `Record<string, () => void>` written in a thousand files is ONE type with one
   * id, and the id is already on the object the previous request returned. On a
   * 2,000-file tree this halves the round trips, from ~16,100 to ~8,100, and
   * round trips are what the scan costs.
   *
   * Sound to cache because a `Program` is immutable and a host lives for one
   * run. Nothing here reacts to a file changing on disk mid-run; see the
   * negative space above.
   */
  indexSignatures(type: Type): Promise<readonly IndexInfo[]>;
  /**
   * Whether the name at `node` resolves to a declaration in one of `fileKeys`,
   * which is `programPathKeys` over the caller's walked file names.
   *
   * The question a check asks before staying quiet about a type REFERENCE: a
   * reference to a name the check will ALSO walk is not the site of the
   * violation, the declaration is, and reporting both files one finding per use.
   *
   * The set is the caller's walked files, not the program's, and the difference
   * is the whole point. `lib.d.ts`, `node_modules`, a `.d.ts` inside the tree, a
   * test file and another declared tree are all in the program and none of them
   * is walked — so a bag declared in any of them reports at each use, which is
   * the only place it can. Asking "is it in the program" instead makes
   * `declare type Bag = Record<string, unknown>` in an ambient file a
   * catalog-wide off-switch.
   */
  declaredIn(node: Node, fileKeys: ReadonlySet<string>): Promise<boolean>;
};

/**
 * Owns the TypeScript process. One per RUN, not one per tree: the projects share
 * a server, and a second process would double the boot cost to answer the same
 * questions.
 *
 * `dispose` matters. The API spawns a child, and a run that throws without
 * disposing leaves it alive — in a watch loop that is one orphaned compiler per
 * iteration.
 */
export type TypeCheckerHost = {
  forTree(projectRoot: string, tree: DeclaredTree): Promise<TreeTypeChecker>;
  dispose(): void;
};

let shared: TypeCheckerHost | undefined;

/**
 * The run's one host, created on first use.
 *
 * Module state, deliberately, because the thing it owns is process state: the
 * `API` spawns a CHILD PROCESS, and "how many TypeScript servers does this
 * process have" is not a question a per-tree or per-check value can answer. The
 * alternative — threading a host parameter through `createTreeContexts` — puts
 * it in the signature of three call sites that have no opinion about types, and
 * still cannot stop a fourth from constructing a second one.
 *
 * Lazy is the load-bearing half: a project whose enabled checks are all
 * structural never calls this, so it never pays the boot. `runStructuralChecks`
 * disposes it when the run ends whether or not it was ever created.
 */
export function sharedTypeCheckerHost(): TypeCheckerHost {
  shared ??= createTypeCheckerHost();
  return shared;
}

/**
 * Ends the run's TypeScript process, if there is one.
 *
 * Not optional cleanup. The API spawns a child, and Bun will not exit while it
 * is alive — a harness that forgets this hangs after its last assertion rather
 * than failing, which reads as a slow suite rather than a leak.
 */
export function disposeTypeCheckerHost(): void {
  shared?.dispose();
  shared = undefined;
}

export function createTypeCheckerHost(): TypeCheckerHost {
  const api = new API({});
  const openProjects: string[] = [];
  let snapshot: Snapshot | undefined;

  // Keyed by project AND type id: two projects each number their types from
  // their own registry, so a bare id collides across them and hands one tree the
  // other's answer.
  const typeFacts = new Map<string, readonly IndexInfo[]>();

  async function ensureSnapshot(tsconfig: string): Promise<Snapshot> {
    if (!openProjects.includes(tsconfig)) {
      openProjects.push(tsconfig);
      snapshot = await api.updateSnapshot({ openProjects });
    }
    snapshot ??= await api.updateSnapshot({ openProjects });
    return snapshot;
  }

  return {
    async forTree(projectRoot, tree) {
      const tsconfig = resolve(projectRoot, tree.tsconfig);
      const snap = await ensureSnapshot(tsconfig);
      const project = snap.getProject(tsconfig);
      if (!project) {
        throw new Error(
          `The tree at '${tree.root}' declares tsconfig '${tree.tsconfig}', and TypeScript loaded no ` +
            `project from it. Every types check on this tree would report nothing, which reads ` +
            `exactly like a tree with no violations.`,
        );
      }
      const { program, checker } = project;

      return {
        program,
        checker,

        async sourceFileNames() {
          return program.getSourceFileNames();
        },

        async indexSignatures(type) {
          const key = `${project.id}#${type.id}`;
          const memo = typeFacts.get(key);
          if (memo !== undefined) return memo;
          const infos = await checker.getIndexInfosOfType(type);
          typeFacts.set(key, infos);
          return infos;
        },

        async declaredIn(node, fileKeys) {
          // The three spellings of "the name in this node": a type reference
          // (`Bag`), a `typeof` query (`typeof KEYS`), and a declaration's own
          // name. Asked here rather than in each check because getting it wrong
          // fails NOISY, not silent: an unanswerable question reads as
          // not-declared, which reports. That is the safe direction for a
          // catalog whose worst failure is a quiet zero, and the expensive one
          // for its users — a check that reports every alias use is one nobody
          // keeps on, so the reading is here where one fixture covers it.
          const named = node as { typeName?: Node; exprName?: Node; name?: Node };
          const name = named.typeName ?? named.exprName ?? named.name;
          if (!name) return false;
          const symbol = await checker.getSymbolAtLocation(name);
          const declarations = symbol?.declarations ?? [];
          if (declarations.length === 0) return false;
          // EVERY declaration, not any: a name that merges a walked declaration
          // with an ambient one is reachable through the ambient half, and
          // staying quiet on the strength of the walked half is the merge being
          // used as a hatch.
          return declarations.every((handle) => fileKeys.has(programPathKey(handle.path)));
        },
      };
    },

    dispose() {
      api.close();
    },
  };
}
