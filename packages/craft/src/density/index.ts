/**
 * Row density for data-dense software surfaces.
 *
 * Three densities, all on a 4px grid, following the convention Linear and Stripe
 * both settled on. A back office and a marketing page have genuinely different
 * needs: a table an operator scans for six hours wants 32px rows, and the same
 * component on a client-facing dashboard wants 48px so it does not read as a
 * spreadsheet.
 *
 * Emitted under `[data-density]`, so a shell sets it once and every table below
 * inherits rather than each one taking a prop.
 */

export const DENSITIES = {
  compact: { rowPx: 32, padXPx: 8, padYPx: 4, fontPx: 13 },
  comfortable: { rowPx: 40, padXPx: 12, padYPx: 8, fontPx: 14 },
  spacious: { rowPx: 48, padXPx: 16, padYPx: 12, fontPx: 15 },
} as const;

export type DensityName = keyof typeof DENSITIES;

export interface DensityCssOptions {
  /** Which density the bare `:root` block carries. Defaults to comfortable. */
  base?: DensityName;
  rootPx?: number;
}

/**
 * Emit the density tokens: a default set plus one `[data-density="..."]` block
 * per density.
 */
export function densityCss(options: DensityCssOptions = {}): string {
  const { base = "comfortable", rootPx = 16 } = options;

  const declare = (name: DensityName, indent = "  "): string => {
    const d = DENSITIES[name];
    return [
      `${indent}--craft-density-row: ${d.rowPx / rootPx}rem;`,
      `${indent}--craft-density-pad-x: ${d.padXPx / rootPx}rem;`,
      `${indent}--craft-density-pad-y: ${d.padYPx / rootPx}rem;`,
      `${indent}--craft-density-font: ${d.fontPx / rootPx}rem;`,
    ].join("\n");
  };

  const blocks = [`:root {\n${declare(base)}\n}`];
  for (const name of Object.keys(DENSITIES) as DensityName[]) {
    blocks.push(`[data-density="${name}"] {\n${declare(name)}\n}`);
  }
  return `${blocks.join("\n\n")}\n`;
}

/** The density tokens as a flat map, for callers emitting their own CSS. */
export function densityTokens(name: DensityName, rootPx = 16): Record<string, string> {
  const d = DENSITIES[name];
  return {
    "--craft-density-row": `${d.rowPx / rootPx}rem`,
    "--craft-density-pad-x": `${d.padXPx / rootPx}rem`,
    "--craft-density-pad-y": `${d.padYPx / rootPx}rem`,
    "--craft-density-font": `${d.fontPx / rootPx}rem`,
  };
}
