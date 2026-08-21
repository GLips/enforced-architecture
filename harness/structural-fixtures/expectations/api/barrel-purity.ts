import type { CheckFixtures } from "../../expectations.ts";

export const barrelPurityFixtures: CheckFixtures = {
  check: "api/barrel-purity",

  // Filed against the BARREL, never the module holding the offending import.
  // The barrel is where the fix lands — move the export to index.server.ts, or
  // put it behind a server function — and pointing at it is half of what the
  // rule teaches. A finding on `service/session.ts` says "this file imports
  // stripe", which is true of every server module in the repo.
  obvious: [
    // index.ts → controllers/payments.ts → service/session.ts → "stripe".
    // Three hops, so a depth-1 implementation reports it clean.
    "FAIL src/features/checkout/index.ts",
  ],

  adversarial: [
    // The same violation with the middle hop written as `@/shared/…`. A trace
    // that follows only relative specifiers ends inside the feature and reports
    // clean — and the aliased spelling is the one the boundary rules REQUIRE of
    // a crossing, so it is how a real chain leaves a feature.
    "FAIL src/features/telemetry/index.ts",
    // A DOMAIN barrel over a module that merely mentions `createServerFn`.
    // Domains are traced without the short-circuit, so a check that applies it
    // everywhere goes silent here while every feature fixture stays green.
    "FAIL src/domains/encryption/index.ts",
    // The chain's middle hop is an `.mts` file. This check spelled its own
    // two-extension resolution list while every walker had eight, so the trace
    // stopped at the hop and the barrel read clean — a hole its own header
    // named and did not close.
    "FAIL src/features/ledger/index.ts",
    // The same hop spelled with the extension TypeScript EMITS — `.js` naming a
    // `.ts` file, which `moduleResolution: "nodenext"` requires rather than
    // permits. The predecessor resolved by appending suffixes to the specifier,
    // and no suffix turns `.js` into `.ts`: the trace ended there, the barrel
    // read clean, and every message this check emitted carried a paragraph
    // saying so. `ledger` above is the extensionless twin and passed throughout.
    "FAIL src/features/nodenext/index.ts",
    // The SECOND `.js` hop of that barrel, and it is a second entry rather than
    // a second fixture because it was a second hole. `Chart.tsx` emits `.js`
    // under the default `jsx` setting, not `.jsx`, so a table giving `.js` only
    // `.ts` follows the hop above and loses this one — one finding, the
    // component chain silent, and every other case here green. The count is the
    // whole assertion: the two only pass together.
    "FAIL src/features/nodenext/index.ts",
    // The THIRD hop of that barrel: a real `.js` file imported by the name it
    // actually has. `extensionAlias` REPLACES an extension rather than adding to
    // it, so the nodenext mapping and plain JavaScript are one entry, and a
    // table that maps `.js` to the TypeScript sources alone closes the second
    // half in silence. It is the only `.js` source in the tree.
    "FAIL src/features/nodenext/index.ts",
    // A side-effect import of a server-only package. It binds no name, so
    // "every specifier in this statement is type-only" is VACUOUSLY true of it
    // — and reading that as erased drops the most unambiguously runtime import
    // in the language. Nothing else in the tree distinguishes the two.
    "FAIL src/features/sideeffect/index.ts",
    // A hop spelled with a UNICODE ESCAPE, on each of the THREE readers that can
    // produce a specifier: the import record, the export record, and the AST.
    // The parser's COOKED value is the module's name; the source text is only
    // its spelling, and a resolver handed the spelling finds nothing, stops the
    // trace, and reports the barrel clean. No one of these can be lost while the
    // others hold — they are separate code paths reading separate structures.
    "FAIL src/features/escapade/index.ts",
    "FAIL src/features/travesty/index.ts",
    "FAIL src/features/masque/index.ts",
    // The boundary FAKED: a side-effect import of the framework module plus a
    // local function called `createServerFn`. Both halves of a two-question
    // boundary test are satisfied and no boundary is crossed — a review used
    // exactly this to suppress the reachable `postgres` finding with a green run.
    "FAIL src/features/impostor/index.ts",
    // The boundary SHADOWED: the framework import is real and unused, and the
    // call that runs is a parameter of the same name. Reading the import clause
    // and then accepting any same-named call anywhere in the file treats this as
    // a boundary and stops. This tier has no parser, so scope is approximated
    // one-sidedly — see `rebindsName`.
    "FAIL src/features/shadow/index.ts",
    // The same shadow with no parentheses around the parameter. A detector that
    // looks for a parameter after `(` or `,` sees nothing — an arrow with one
    // parameter needs neither.
    "FAIL src/features/curtain/index.ts",
    // The same shadow introduced by a destructuring pattern, where the character
    // before the name is `{`. One spelling per feature so that deleting one
    // binding form turns exactly one of these red.
    "FAIL src/features/drape/index.ts",
    // The same shadow DECLARED rather than parameterised — a nested `const` of
    // the imported name. This form was deletable-green until this fixture:
    // nothing else in the tree reached it.
    "FAIL src/features/pelmet/index.ts",
    // The boundary's name imported FROM the boundary module and bound to
    // something else: `import { unrelatedExport as createServerFn }`. Searching
    // the clause for the call's name finds it on the local side of the `as`, so
    // the trace stopped at a boundary this file never crossed — a review left
    // all 16 checks green that way.
    "FAIL src/features/sconce/index.ts",
    // The same shadow with the destructuring RENAMED, so the name sits after the
    // colon: `{ bridge: createServerFn }`. A reader that takes only the shorthand
    // key position misses it, and the legal `orders` fixture is why it cannot
    // simply accept every colon — the two pin opposite sides of one distinction.
    "FAIL src/features/valance/index.ts",
    // The boundary FABRICATED by a string: no framework import at all, just a
    // quoted one beside a local function aliased to the boundary's name. This is
    // the contract's NEVER clause — a spelling ACCEPTED as a boundary that is not
    // one — and the reason both accepting halves read literal-masked text.
    "FAIL src/features/facade/index.ts",
    // The same fabrication where masking cannot help: the import statement is
    // JSX TEXT, neither string nor comment. Masking one more container per review
    // is the loop that ends at the transpiler gate — the real lexer already knows
    // which specifiers this file imports, and no spelling of one gets into that
    // answer without being one.
    "FAIL src/features/awning/index.ts",
  ],

  legal: [
    // A chain reaching a server-only package for its TYPES only. The import is
    // erased, so nothing of `stripe` reaches a bundle — this check drops
    // type-only edges, while the import graph over the same scan keeps them.
    // One scan, two readings, and this is the file that proves the reading here
    // is not the scanner's.
    "src/features/erased/index.ts",
    // The server-only leaf sits below a REAL server-function boundary, so the
    // framework strips it from the client bundle and the trace must stop. This
    // is the ordinary way a feature exposes a mutation: a check that fires here
    // gets switched off rather than fixed. Its controller also holds an object
    // literal spelling `{ createServerFn: … }`, which is not a binding — a
    // shadow test that read a `:` as one reported this barrel.
    "src/features/orders/index.ts",
    // The traced module's only `stripe` reference is `import type`. Erased at
    // compile time, so it cannot break a client bundle — and a check reaching
    // for the import graph's reveal pass reports it.
    "src/features/invoices/index.ts",
    // Two modules below the barrel re-export each other. Without a visited set
    // the trace runs to the depth cap and reports the cap against a barrel that
    // imports nothing server-only at all.
    "src/features/loyalty/index.ts",
    // The hop is `./service/rates.js` and BOTH `rates.ts` and `rates.js` are on
    // disk — a build step's output left beside its source. The `.ts` is clean
    // and the `.js` reaches `postgres`, so this barrel is silent only while
    // `extensionAlias` keeps source extensions ahead of the emitted one. Reverse
    // that order and it reports a chain the compiler never builds; nothing else
    // in the tree has both spellings of one module.
    "src/features/compiled/index.ts",
    // Already in the tree for `placement/topology`: a barrel re-exporting one
    // local module that imports nothing. The trivial case still has to be
    // silent, and it is the only barrel here that predates this check.
    "src/features/scanner/index.ts",
  ],
};
