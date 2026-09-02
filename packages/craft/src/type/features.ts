/**
 * Typographic settings that are house habits rather than per-project choices.
 *
 * These numbers were already being written by hand, identically, across separate
 * client repos — `-0.01em` display tracking appears in two codebases that share
 * no code. Systematising them is the point: quality that depends on somebody
 * remembering to type `-0.01em` tracks per-build effort rather than the standard.
 */

export const HOUSE_TYPE = {
  /**
   * Letter-spacing. Display type is set tighter because tracking that reads as
   * neutral at 16px reads as loose at 48px; buttons and eyebrows go the other
   * way, because short all-caps strings need air to stay countable.
   */
  tracking: {
    display: "-0.01em",
    heading: "-0.005em",
    body: "0em",
    button: "0.12em",
    eyebrow: "0.24em",
  },
  /** Line height. Tighter as type gets larger, since the eye tracks a shorter return. */
  leading: {
    display: "1.05",
    heading: "1.1",
    subheading: "1.3",
    body: "1.6",
  },
  /**
   * Measure, in `ch`. Below ~45 the eye returns too often; above ~75 it loses
   * the line on the way back.
   */
  measure: {
    narrow: "45ch",
    body: "65ch",
    wide: "75ch",
  },
} as const;

/** Emit the type-feature tokens. */
export function typeFeatureTokens(): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const [name, value] of Object.entries(HOUSE_TYPE.tracking)) {
    tokens[`--craft-tracking-${name}`] = value;
  }
  for (const [name, value] of Object.entries(HOUSE_TYPE.leading)) {
    tokens[`--craft-leading-${name}`] = value;
  }
  for (const [name, value] of Object.entries(HOUSE_TYPE.measure)) {
    tokens[`--craft-measure-${name}`] = value;
  }
  return tokens;
}
