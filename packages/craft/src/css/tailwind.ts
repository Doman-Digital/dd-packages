/**
 * Tailwind adapters.
 *
 * Two, because the estate is on two major versions and neither is going to move
 * for the other. Both point at the same `--craft-*` custom properties rather
 * than restating values, so a Tailwind utility and a hand-written rule cannot
 * disagree.
 */

import { DENSITIES, type DensityName } from "../density/index.js";
import { DURATION_MS, EASE } from "../motion/tokens.js";
import { HOUSE_TYPE } from "../type/features.js";
import { SPACE_STEPS } from "../space/scale.js";
import { TYPE_STEPS } from "../type/scale.js";

/** Step name as it appears in a custom property (`-2` becomes `--2`). */
function stepName(step: number): string {
  return step < 0 ? `-${Math.abs(step)}` : String(step);
}

export interface TailwindPreset {
  theme: {
    extend: Record<string, unknown>;
  };
}

/**
 * A Tailwind v3 preset, for consumers on the older config format.
 *
 * Every entry is a `var()` reference. That matters: a preset that inlined the
 * computed values would freeze them at build time, and the point of the token
 * layer is that a site can override an anchor without rebuilding the preset.
 */
export function tailwindV3Preset(): TailwindPreset {
  const fontSize: Record<string, string> = {};
  for (const step of TYPE_STEPS) {
    fontSize[`step-${stepName(step)}`] = `var(--craft-step-${stepName(step)})`;
  }

  const spacing: Record<string, string> = {};
  for (const step of Object.keys(SPACE_STEPS)) {
    spacing[step] = `var(--craft-space-${step})`;
  }
  for (const size of ["sm", "md", "lg"] as const) {
    spacing[`section-${size}`] = `var(--craft-section-${size})`;
  }

  const transitionTimingFunction: Record<string, string> = {};
  for (const name of Object.keys(EASE)) {
    const kebab = name.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
    transitionTimingFunction[kebab] = `var(--craft-ease-${kebab})`;
  }

  const transitionDuration: Record<string, string> = {};
  for (const name of Object.keys(DURATION_MS)) {
    transitionDuration[name] = `var(--craft-duration-${name})`;
  }

  const colors: Record<string, string> = {};
  for (const token of [
    "bg-canvas",
    "bg-base",
    "bg-surface",
    "bg-elevated",
    "text-primary",
    "text-secondary",
    "text-muted",
    "text-on-accent",
    "border-subtle",
    "border-strong",
    "accent",
    "accent-hover",
    "accent-soft",
    "accent-text",
    "success",
    "warning",
    "danger",
    "info",
  ]) {
    colors[token] = `var(--craft-${token})`;
  }

  const letterSpacing: Record<string, string> = {};
  for (const name of Object.keys(HOUSE_TYPE.tracking)) {
    letterSpacing[name] = `var(--craft-tracking-${name})`;
  }

  const lineHeight: Record<string, string> = {};
  for (const name of Object.keys(HOUSE_TYPE.leading)) {
    lineHeight[name] = `var(--craft-leading-${name})`;
  }

  const maxWidth: Record<string, string> = {};
  for (const name of Object.keys(HOUSE_TYPE.measure)) {
    maxWidth[`measure-${name}`] = `var(--craft-measure-${name})`;
  }

  const minHeight: Record<string, string> = { row: "var(--craft-density-row)" };

  return {
    theme: {
      extend: {
        colors,
        fontSize,
        spacing,
        letterSpacing,
        lineHeight,
        maxWidth,
        minHeight,
        transitionTimingFunction,
        transitionDuration,
      },
    },
  };
}

/**
 * The Tailwind v4 `@theme inline` block.
 *
 * `inline` is required rather than optional: without it Tailwind copies the
 * value at build time, so a runtime override of the underlying custom property
 * would not reach the generated utility.
 */
export function tailwindV4Theme(): string {
  const lines: string[] = ["@theme inline {"];

  const add = (name: string, value: string): void => {
    lines.push(`  ${name}: ${value};`);
  };

  for (const token of [
    "bg-canvas",
    "bg-base",
    "bg-surface",
    "bg-elevated",
    "text-primary",
    "text-secondary",
    "text-muted",
    "text-on-accent",
    "border-subtle",
    "border-strong",
    "accent",
    "accent-hover",
    "accent-soft",
    "accent-text",
    "success",
    "warning",
    "danger",
    "info",
  ]) {
    add(`--color-${token}`, `var(--craft-${token})`);
  }

  for (const step of TYPE_STEPS) {
    add(`--text-step-${stepName(step)}`, `var(--craft-step-${stepName(step)})`);
  }

  for (const step of Object.keys(SPACE_STEPS)) {
    add(`--spacing-${step}`, `var(--craft-space-${step})`);
  }
  for (const size of ["sm", "md", "lg"] as const) {
    add(`--spacing-section-${size}`, `var(--craft-section-${size})`);
  }

  for (const name of Object.keys(EASE)) {
    const kebab = name.replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`);
    add(`--ease-${kebab}`, `var(--craft-ease-${kebab})`);
  }

  for (const name of Object.keys(DURATION_MS)) {
    add(`--duration-${name}`, `var(--craft-duration-${name})`);
  }

  for (const name of Object.keys(HOUSE_TYPE.tracking)) {
    add(`--tracking-${name}`, `var(--craft-tracking-${name})`);
  }
  for (const name of Object.keys(HOUSE_TYPE.leading)) {
    add(`--leading-${name}`, `var(--craft-leading-${name})`);
  }

  lines.push("}");
  return `${lines.join("\n")}\n`;
}

/** Density names, re-exported so a consumer can type its shell prop. */
export const DENSITY_NAMES = Object.keys(DENSITIES) as DensityName[];
