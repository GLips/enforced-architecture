// EXPECT+1: three conditionals in one expression
export const label = (n: number) => (n > 100 ? "high" : n > 50 ? "mid" : n > 10 ? "low" : "none");
