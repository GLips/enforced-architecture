// Support for the type-only fixture: a type with no runtime value beside it, so
// the only way to reach this feature is an import the reader erases.
export type ShapeSpec = { id: string; sides: number };
