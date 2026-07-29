// Two conditionals is the documented budget: this rule flags three.
export const status = (n: number) => (n > 50 ? "high" : n > 10 ? "low" : "none");

// Three SEPARATE ternaries are three readable expressions, not one nested one.
export const a = (n: number) => (n > 0 ? "x" : "y");
export const b = (n: number) => (n > 1 ? "x" : "y");
export const c = (n: number) => (n > 2 ? "x" : "y");

// A ternary beside an if/else chain, which is the refactor the rule asks for.
export const tone = (n: number) => {
  if (n > 100) return "high";
  if (n > 50) return "mid";
  return n > 10 ? "low" : "none";
};
