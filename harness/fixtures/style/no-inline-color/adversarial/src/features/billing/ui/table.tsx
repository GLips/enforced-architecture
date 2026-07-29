export const styles = {
  // EXPECT: an rgb() function rather than a hex literal
  border: "rgb(10, 12, 16)",
  // EXPECT: hsla, single-quoted
  shadow: 'hsla(210, 20%, 5%, 0.4)',
  // EXPECT: the three-digit hex shorthand
  accent: "#fff",
  // EXPECT: a hex buried inside a longer value, not the whole string
  gradient: "linear-gradient(90deg, #0a0c10, transparent)",
};

// EXPECT+1: a color PROP on a component, which is not an object property at all
export const Row = () => <Text c="#0a0c10" />;

declare function Text(p: { c: string }): null;
