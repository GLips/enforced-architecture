// The `.mts` hop. Server-only by way of `postgres`, and reachable only if the
// resolver tries this extension — which is the point of the fixture.
import postgres from "postgres";

export const postEntry = (amount: number): number => {
  void postgres;
  return amount;
};
