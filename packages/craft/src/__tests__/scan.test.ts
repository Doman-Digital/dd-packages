import { describe, expect, it } from "vitest";
import { scanSource } from "../character/check.js";
import { findColours, isAiViolet } from "../character/color.js";
import { classUnits, cssDeclarations } from "../character/parse.js";
import { REVEAL_LIMIT } from "../character/tells/source.js";

const ids = (files: { path: string; text: string }[]): string[] =>
  [...new Set(scanSource(files).findings.map((f) => f.tell))].sort();

describe("reading source", () => {
  it("joins every literal inside className={cn(...)} into one element", () => {
    const units = classUnits(`<a className={cn("rounded-full border", active && "px-3 text-xs")} />`);
    expect(units).toHaveLength(1);
    expect(units[0].classes).toEqual(["rounded-full", "border", "px-3", "text-xs"]);
  });

  it("keeps cva variants apart, because a variant is an alternative", () => {
    const units = classUnits(`const b = cva("inline-flex", { variants: { a: { x: "rounded-full", y: "border" } } });`);
    expect(units.map((u) => u.classes)).toEqual([["inline-flex"], ["rounded-full"], ["border"]]);
  });

  it("walks through @theme, @media and @layer, and ignores comments", () => {
    const decls = cssDeclarations(`/* --accent: #7c3aed; */\n@theme { --color-brand: #5a35d1; }\n@media (min-width: 1px) { .a { color: red; } }`);
    expect(decls.map((d) => [d.property, d.selector])).toEqual([
      ["--color-brand", "@theme"],
      ["color", ".a"],
    ]);
  });

  it("does not split a declaration on the semicolon inside a data URI", () => {
    const decls = cssDeclarations(`.a { background: url(data:image/svg+xml;base64,AAA); color: blue; }`);
    expect(decls.map((d) => d.property)).toEqual(["background", "color"]);
  });

  it("reads hex, rgb, hsl and oklch into the same hue", () => {
    for (const raw of ["#7c3aed", "rgb(124 58 237)", "rgba(124, 58, 237, 1)", "hsl(262 83% 58%)", "oklch(54.1% 0.281 293)"]) {
      const [c] = findColours(raw);
      expect(c, raw).toBeDefined();
      expect(isAiViolet(c.oklch), raw).toBe(true);
    }
  });

  it("leaves a plumber's navy and a teal alone", () => {
    for (const raw of ["#1e3a8a", "#0f766e", "#2563eb"]) expect(isAiViolet(findColours(raw)[0].oklch), raw).toBe(false);
  });
});

describe("findings the estate survey says a rule must reproduce", () => {
  it("sen-sphere: a violet set in hex, which no class-name grep can see", () => {
    const report = scanSource([
      { path: "src/app/globals.css", text: `:root {\n  --brand: #5a35d1;\n}` },
      { path: "src/components/Cta.tsx", text: `<a className="bg-[#5a35d1] text-white">Join</a>` },
    ]);
    const violet = report.findings.filter((f) => f.tell === "ai-violet");
    expect(violet.map((f) => [f.path, f.line])).toEqual([
      ["src/app/globals.css", 2],
      ["src/components/Cta.tsx", 1],
    ]);
  });

  it("Rise & Bloom: a glass hero and a three-column icon grid", () => {
    const hero = `export function Hero() {\n  return <div className="rounded-3xl bg-white/20 p-10 backdrop-blur-lg"><h1>Rise & Bloom</h1></div>;\n}`;
    const features = [
      `import { Leaf, Sun, Heart } from "lucide-react";`,
      `export function Features() {`,
      `  return <div className="grid gap-8 md:grid-cols-3">{items.map((i) => (`,
      `    <div><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100"><i.icon /></div></div>`,
      `  ))}</div>;`,
      `}`,
    ].join("\n");
    expect(ids([{ path: "Hero.tsx", text: hero }, { path: "Features.tsx", text: features }])).toEqual(
      expect.arrayContaining(["glass-panel", "icon-tile-grid", "icon-tile-stack"]),
    );
  });

  it("MMM: reveal on nearly every section", () => {
    const page = Array.from({ length: 70 }, (_, i) => `<Reveal delay={${i}}><Section${i} /></Reveal>`).join("\n");
    const [finding] = scanSource([{ path: "app/page.tsx", text: page }]).findings.filter((f) => f.tell === "reveal-everywhere");
    expect(finding.message).toContain(`70 scroll reveals (limit ${REVEAL_LIMIT})`);
  });

  it("the estate's reflex fonts, however they are loaded", () => {
    const files = [
      { path: "app/layout.tsx", text: `import { Inter, Space_Grotesk } from "next/font/google";` },
      { path: "index.html", text: `<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;700&family=Manrope" rel="stylesheet">` },
      { path: "tailwind.config.js", text: `module.exports = { theme: { extend: { fontFamily: { sans: ["Inter Tight", "sans-serif"] } } } };` },
      { path: "main.tsx", text: `import "@fontsource/inter";` },
    ];
    const names = scanSource(files).findings.map((f) => f.message.replace(" is a reflex font", "")).sort();
    expect(names).toEqual(["DM Sans", "Inter", "Inter", "Inter Tight", "Manrope", "Space Grotesk"]);
  });
});

describe("gaps the 2026-09-11 research named", () => {
  const tileGrid = (library: string) =>
    [
      `import { UilBolt, UilPlug } from "${library}";`,
      `export function Services() {`,
      `  return <div className="grid gap-6 md:grid-cols-3">`,
      `    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100"><UilBolt /></div>`,
      `  </div>;`,
      `}`,
    ].join("\n");

  it("an icon-tile grid is the same tell whichever library draws the icons", () => {
    for (const library of ["@iconscout/react-unicons", "@mui/icons-material", "react-material-symbols/rounded"]) {
      expect(ids([{ path: "Services.tsx", text: tileGrid(library) }]), library).toEqual(
        expect.arrayContaining(["icon-tile-grid", "icon-tile-stack"]),
      );
    }
  });

  it("Cal Sans is a second-wave reflex font", () => {
    const [finding] = scanSource([{ path: "src/styles.css", text: `@theme {\n  --font-display: "Cal Sans", system-ui, sans-serif;\n}` }]).findings.filter((f) => f.tell === "reflex-font-2");
    expect(finding?.message).toContain("Cal Sans");
  });
});

describe("what the scanner must not flag", () => {
  it("ignores the framework's own palette definitions", () => {
    const compiled = `@layer theme { :root { --color-indigo-600: oklch(51.1% .262 276.966); --color-violet-500: oklch(60.6% .25 292.717); } }`;
    expect(scanSource([{ path: "dist.css", text: compiled }]).findings).toEqual([]);
  });

  it("does not read Introduction.tsx as an intro cinematic", () => {
    expect(ids([{ path: "components/Introduction.tsx", text: `setTimeout(() => {}, 1)` }])).toEqual([]);
  });

  it("does not count an eyebrow chip that sits below the heading", () => {
    expect(ids([{ path: "Hero.tsx", text: `<h1>Title</h1>\n<span className="rounded-full border px-3 text-xs">x</span>` }])).toEqual([]);
  });
});

describe("exceptions", () => {
  const dd = [{ path: "app/globals.css", text: `:root { --accent: #7050f5; }` }];

  it("DD's violet passes once it is declared with a reason", () => {
    const report = scanSource(dd, {
      exceptions: [{ tell: "ai-violet", because: "Violet has been the Doman Digital mark since 2019, on the van and the cards." }],
    });
    expect(report.findings).toEqual([]);
    expect(report.excepted).toEqual([{ tell: "ai-violet", because: expect.any(String), count: 1 }]);
  });

  it("an exception with no real reason is not applied", () => {
    const report = scanSource(dd, { exceptions: [{ tell: "ai-violet", because: "brand" }] });
    expect(report.findings.map((f) => f.tell)).toEqual(["ai-violet"]);
    expect(report.rejectedExceptions[0].reason).toMatch(/because/);
  });

  it("an exception for a tell that does not exist is reported, not ignored", () => {
    const report = scanSource(dd, { exceptions: [{ tell: "violet", because: "A typo should not silently do nothing." }] });
    expect(report.rejectedExceptions[0].reason).toMatch(/no tell called "violet"/);
  });

  it("can be limited to a path", () => {
    const report = scanSource([...dd, { path: "site/b.css", text: `.x { color: #7050f5; }` }], {
      exceptions: [{ tell: "ai-violet", because: "Only the agency site carries the violet mark.", path: "app/" }],
    });
    expect(report.findings.map((f) => f.path)).toEqual(["site/b.css"]);
  });
});

describe("colour as a browser returns it", () => {
  it("reads oklab() and color(srgb) as well as rgb() and oklch()", async () => {
    const { parseColour, isAiViolet } = await import("../character/color.js");
    expect(isAiViolet(parseColour("rgb(90, 53, 209)")!.oklch)).toBe(true);
    expect(isAiViolet(parseColour("oklch(0.541 0.281 293.009)")!.oklch)).toBe(true);
    expect(isAiViolet(parseColour("color(srgb 0.353 0.208 0.82)")!.oklch)).toBe(true);
    expect(isAiViolet(parseColour("oklab(0.5 0.05 -0.2)")!.oklch)).toBe(true);
    expect(parseColour("color(srgb 0.353 0.208 0.82 / 0.5)")!.alpha).toBeCloseTo(0.5);
    expect(isAiViolet(parseColour("rgb(15, 118, 110)")!.oklch)).toBe(false);
  });
});
