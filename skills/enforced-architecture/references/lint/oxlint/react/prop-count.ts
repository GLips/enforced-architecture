// ─── react/prop-count ─────────────────────────────────────────────────
//
// Shows: Each exported component that declares the threshold number of props or
// more, and the count. A reader learns which components make every call site
// supply many values, and which one to split next. The rule only warns, so the
// count is a report and not a property you can depend on.
//
// The rule never adds the annotation and the destructure together. `({ a, b }:
// { a: string; b: string })` declares the same two props twice, and a sum
// doubles every name. Names merge as a SET for the same reason: `Model & {
// tone?: Tone }` is one prop in TypeScript and must be one prop here.
//
// Only BASES expand. A member with a named type — `result: ScanResultViewModel`
// — is one prop. To expand it makes the rule report the shape it asks for:
// props that a call site always passes together, put into one object.
//
// A base this rule cannot read in this file adds nothing, and the count becomes
// a floor. A JS plugin gets no type checker, thus the rule cannot read a type
// that another file declares. The message says "at least N props" and names
// the base. A missing report does not mean the true count is below the
// threshold, and a report on every `extends ViewProps` is a permanent warning
// that a person cannot act on. A floor can miss a wide component. It cannot
// report one that is not wide.
//
// SCOPE, and it is the same for every rule in this catalog: this rule is silent
// outside the declared trees, and silent on the files `isArchitectureExemptPath`
// names inside them — tests, scripts, generated and ambient modules. Neither
// silence is coverage. `lib/define-tree-rule.ts` owns both, which is why no rule
// body checks either one.
// ──────────────────────────────────────────────────────────────────────

import { defineTreeRule } from "../lib/define-tree-rule.ts";
import { type ESTree } from "@oxlint/plugins";
import { isComponentFile } from "../../policy/declared-trees.ts";
import { exportedComponents, type ComponentFunction } from "../lib/component-declarations.ts";
import { numericRuleOption } from "../lib/rule-options.ts";

const DEFAULT_THRESHOLD = 8;

/** A structural convention rather than a data dependency the component chose to accept. */
const NOT_A_PROP = new Set(["children"]);

/** Every way a props type can be declared, keyed by name, for same-file resolution. */
type TypeDeclarations = ReadonlyMap<
  string,
  ESTree.TSTypeAliasDeclaration | ESTree.TSInterfaceDeclaration
>;

/**
 * What a props type declares: the distinct member names, and whether the rule read the whole of it.
 */
type PropSurface = {
  names: Set<string>;
  /** False once any part of the type could not be read. `names` is then a floor. */
  complete: boolean;
  /** Bases the rule could not read out of this file, named for the finding. */
  unresolved: string[];
};

export const propCountRule = defineTreeRule({
  meta: {
    type: "suggestion",
    schema: [
      {
        type: "object",
        properties: { threshold: { type: "integer", minimum: 1 } },
        additionalProperties: false,
      },
    ],
    defaultOptions: [{ threshold: DEFAULT_THRESHOLD }],
    messages: {
      tooManyProps:
        "{{name}} has {{count}} props (threshold: {{threshold}}). Decompose into smaller components, group props that always travel together into one object, or lift shared data into context. If the wide surface is deliberate — a design-system primitive, or a wrapper forwarding to a third party — raise the threshold in the project's oxlint config.",
      tooManyPropsFloor:
        "{{name}} has at least {{count}} props (threshold: {{threshold}}). That is a floor: this rule could not read {{bases}} out of this file, and it resolves a base type by name within one file, so the real surface is wider. Decompose into smaller components, group props that always travel together into one object, or lift shared data into context.",
    },
  },
  create(context) {
    if (!isComponentFile(context.filename)) return {};

    const threshold = numericRuleOption(context.options[0], "threshold", DEFAULT_THRESHOLD);

    return {
      "Program:exit"(program) {
        const declarations = collectTypeDeclarations(program);

        for (const component of exportedComponents(program)) {
          if (component.fn === null) continue;

          const surface = propSurface(component.fn, declarations);
          if (surface === null || surface.names.size < threshold) continue;

          context.report({
            node: component.node,
            messageId: surface.complete ? "tooManyProps" : "tooManyPropsFloor",
            data: {
              name: component.name,
              count: surface.names.size,
              threshold,
              bases: describeUnresolved(surface),
            },
          });
        }
      },
    };
  },
});

function describeUnresolved(surface: PropSurface): string {
  return surface.unresolved.length > 0
    ? surface.unresolved.join(", ")
    : "part of its props type";
}

/**
 * The file's `type X = …` and `interface X …` declarations.
 *
 * Generic declarations are KEPT, unlike the `types` tag's alias collector: `interface OptionListProps<T>`
 * declares the same members whatever `T` turns out to be, and dropping it would silently demote
 * every generic component to the destructure fallback.
 */
function collectTypeDeclarations(program: ESTree.Program): TypeDeclarations {
  const declarations = new Map<
    string,
    ESTree.TSTypeAliasDeclaration | ESTree.TSInterfaceDeclaration
  >();

  for (const statement of program.body) {
    const declaration =
      statement.type === "ExportNamedDeclaration" ? statement.declaration : statement;
    if (
      declaration?.type === "TSTypeAliasDeclaration" ||
      declaration?.type === "TSInterfaceDeclaration"
    ) {
      declarations.set(declaration.id.name, declaration);
    }
  }

  return declarations;
}

/**
 * The component's prop surface, or null when it declares none this rule can read.
 *
 * The parameter's ANNOTATION is the subject, not a type whose name happens to match the
 * component's. A component annotated `props: RowProps` is read the same as one annotated
 * `props: XProps`, and a project spelling the convention `ComponentAttrs` needs no adapting.
 */
function propSurface(fn: ComponentFunction, declarations: TypeDeclarations): PropSurface | null {
  const [parameter] = fn.params;
  if (parameter === undefined) return null;

  const annotation =
    parameter.type === "Identifier" || parameter.type === "ObjectPattern"
      ? parameter.typeAnnotation?.typeAnnotation
      : undefined;

  if (annotation !== undefined && annotation !== null) {
    const surface = readType(annotation, declarations, new Set());
    // An annotation nothing could be read out of — `props: Pick<ViewProps, …>`, whose members live
    // in a file this rule never opens — is no better than no annotation, so the destructure still
    // gets its turn.
    if (surface.names.size > 0 || surface.complete) return surface;
  }

  // Fallback: the identifiers in the destructuring pattern. This is what catches the component
  // with no annotation at all.
  if (parameter.type !== "ObjectPattern") return null;
  return destructuredSurface(parameter);
}

/** `({ a, b, ...rest })` — `...rest` is explicit forwarding, not a prop the component consumes. */
function destructuredSurface(pattern: ESTree.ObjectPattern): PropSurface {
  const names = new Set<string>();

  for (const property of pattern.properties) {
    if (property.type !== "Property" || property.computed) continue;
    const name = propertyKeyName(property.key);
    if (name !== null && !NOT_A_PROP.has(name)) names.add(name);
  }

  return { names, complete: true, unresolved: [] };
}

/**
 * The members `type` declares, following intersection terms and heritage entries into the types
 * they name.
 *
 * Names are collected as a SET. `Model & { tone?: Tone }` narrowing a member `Model` already
 * declares is one prop in TypeScript and must be one prop here; summing the two sides carries a
 * seven-prop component over an eight-prop threshold, which is the over-count this rule must never
 * commit.
 *
 * Only BASES are followed. A member whose type is a named type — `result: ScanResultViewModel` —
 * is ONE prop, and expanding it would report the very shape this rule asks for.
 */
function readType(
  type: ESTree.TSType,
  declarations: TypeDeclarations,
  visiting: ReadonlySet<string>,
): PropSurface {
  const surface: PropSurface = { names: new Set(), complete: true, unresolved: [] };

  if (type.type === "TSTypeLiteral") {
    absorbMembers(type.members, surface);
    return surface;
  }

  if (type.type === "TSIntersectionType") {
    for (const term of type.types) merge(surface, readType(term, declarations, visiting), null);
    return surface;
  }

  if (type.type === "TSTypeReference" && type.typeName.type === "Identifier") {
    return readReference(type.typeName.name, declarations, visiting);
  }

  // A union of prop shapes has members this walk never reaches, and so does a mapped or utility
  // type. Calling either complete would be the silent under-count this rule was rebuilt to end.
  surface.complete = false;
  return surface;
}

/** The surface of the type `name` refers to, resolved in this file. */
function readReference(
  name: string,
  declarations: TypeDeclarations,
  visiting: ReadonlySet<string>,
): PropSurface {
  // A type is its own ancestor only in code that does not compile, but a rule that loops forever
  // on it is worse than one that under-counts it.
  if (visiting.has(name)) return { names: new Set(), complete: false, unresolved: [] };

  const declaration = declarations.get(name);
  if (declaration === undefined) {
    return { names: new Set(), complete: false, unresolved: [name] };
  }

  const nested = new Set(visiting).add(name);
  if (declaration.type === "TSTypeAliasDeclaration") {
    const surface = readType(declaration.typeAnnotation, declarations, nested);
    return attribute(surface, name);
  }

  const surface: PropSurface = { names: new Set(), complete: true, unresolved: [] };
  for (const heritage of declaration.extends) {
    if (heritage.expression.type !== "Identifier") {
      surface.complete = false;
      continue;
    }
    merge(surface, readReference(heritage.expression.name, declarations, nested), null);
  }
  absorbMembers(declaration.body.body, surface);
  return attribute(surface, name);
}

/**
 * Name a base by ITS OWN name when nothing could be read out of it.
 *
 * `type Behaviour = Pick<ViewProps, …>` resolves, yields nothing, and the reader has to go and look
 * at `Behaviour` — not at `Pick`, which is not the thing they can do anything about.
 */
function attribute(surface: PropSurface, name: string): PropSurface {
  if (surface.complete || surface.names.size > 0) return surface;
  return { names: surface.names, complete: false, unresolved: [name] };
}

function merge(into: PropSurface, from: PropSurface, _unused: null): void {
  for (const member of from.names) into.names.add(member);
  if (from.complete) return;
  into.complete = false;
  into.unresolved.push(...from.unresolved);
}

function absorbMembers(members: readonly ESTree.TSSignature[], surface: PropSurface): void {
  for (const member of members) {
    // A method signature IS a prop — `onDone(): void` and `onDone: () => void` declare the same
    // surface, and the two spellings are indistinguishable to a caller.
    if (member.type !== "TSPropertySignature" && member.type !== "TSMethodSignature") {
      // An index signature declares no named member; it is a shape, not a prop list.
      if (member.type === "TSIndexSignature") surface.complete = false;
      continue;
    }
    if (member.computed) continue;
    const name = propertyKeyName(member.key);
    if (name !== null && !NOT_A_PROP.has(name)) surface.names.add(name);
  }
}

function propertyKeyName(key: ESTree.PropertyKey): string | null {
  if (key.type === "Identifier") return key.name;
  if (key.type === "Literal" && typeof key.value === "string") return key.value;
  return null;
}
