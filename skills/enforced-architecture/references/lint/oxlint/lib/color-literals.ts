/**
 * One owner for "is there a colour literal in this string", and one owner for the boundary between
 * the two style rules that ask.
 *
 * `style/no-inline-color` and `style/no-arbitrary-class-values` both have to recognise a hex, and
 * they held one pattern each. The copies were a `\b` apart, so `#0123456789` matched one and not
 * the other and no fixture named which answer was intended. The pattern below is the one answer.
 *
 * The `\b` is kept, and what it costs is stated where it lands: a run of MORE than eight hex
 * digits after the `#` matches nothing. `#0123456789` is not a colour in any notation, and the
 * boundary is what keeps an anchor or a commit sha in a string value — `"#abcdef123"` — from
 * reading as one.
 */
export const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|(?:rgb|rgba|hsl|hsla)\([^)]*[0-9]/;

/**
 * A utility class carrying an arbitrary value: `bg-[#0a0c10]`, `text-[13px]`, `bg-[var(--x)]`.
 *
 * Deliberately matches the whole bracket rather than only the colour ones. The caller below is
 * removing class syntax from a string, and removing half of it would leave `text-[13px]` in place
 * for a colour rule to read a `#` out of the NEXT class along.
 */
const ARBITRARY_VALUE_BRACKET = /\b[a-z-]+-\[[^\]]*\]/g;

/**
 * The string with every arbitrary-value utility class removed, so what is left is the text a
 * COLOUR rule owns.
 *
 * This is the ownership boundary between the two style rules, made executable. A colour literal
 * inside `bg-[…]` is a class-string defect: the fix is the mapped token class (`bg-surface`), and
 * that is `style/no-arbitrary-class-values`' message. A colour rule reporting the same span
 * prescribes `var(--app-surface)` instead, which inside a class bracket is a THIRD diagnostic
 * (`arbitraryVar`) — one defect, two messages, and following either one leaves the other true.
 *
 * A bare literal is untouched, so `{ color: "#0a0c10" }` and the stray hex in
 * `"bg-surface #0a0c10"` still reach the colour rule.
 */
export function withoutUtilityClasses(text: string): string {
  return text.replace(ARBITRARY_VALUE_BRACKET, " ");
}
