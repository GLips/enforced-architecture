// The other half of the pair, and the one that separates the two capabilities.
// The client conveys EXECUTION: a controller holding it can open a transaction
// and hand it to repo functions, but cannot build a query with it. That is why
// importing this from a controller stays legal when repo/ exists and importing
// the schema does not.
export const db = {
  transaction<T>(body: (tx: typeof db) => T): T {
    return body(db);
  },
};
