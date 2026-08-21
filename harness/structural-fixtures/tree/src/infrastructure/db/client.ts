// The other half of the pair, and the one that separates the two capabilities.
// The client conveys EXECUTION: a controller holding it can open a transaction
// and hand it to repo functions, but cannot build a query with it. That is why
// importing this from a controller stays legal when repo/ exists and importing
// the schema does not.
// Named rather than inferred through `typeof db`, which is circular: the
// method's parameter refers to the very binding being inferred, so TypeScript
// falls back to `any` for `tx` and `types/no-broad-parameters` reports a
// fixture that is not its subject.
export type DbClient = {
  transaction<T>(body: (tx: DbClient) => T): T;
};

export const db: DbClient = {
  transaction(body) {
    return body(db);
  },
};
