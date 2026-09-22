/** Plain-text rendering of a report, for a terminal or a hook. */

import type { CheckReport } from "./types.js";

export function formatReport(report: CheckReport, title: string): string {
  const lines: string[] = [];
  let current = "";
  for (const f of report.findings) {
    if (f.path !== current) {
      current = f.path;
      lines.push("", f.path);
    }
    lines.push(`  ${String(f.line).padStart(4)}  ${f.tell} (gen ${f.generation}, ${f.severity})  ${f.message}`);
    lines.push(`        ${f.excerpt}`);
  }

  const fixes = new Map(report.findings.map((f) => [f.tell, f.fix]));
  if (fixes.size > 0) {
    lines.push("", "What to do instead:");
    for (const [tell, fix] of fixes) lines.push(`  ${tell}: ${fix}`);
  }
  for (const r of report.rejectedExceptions) {
    lines.push("", `Exception not applied (${r.exception.tell}): ${r.reason}`);
  }
  for (const e of report.excepted) {
    lines.push("", `Excepted: ${e.count} × ${e.tell}, because ${e.because}`);
  }

  const { summary } = report;
  const gens = `gen 1: ${summary.byGeneration[1]}, gen 2: ${summary.byGeneration[2]}, gen 3: ${summary.byGeneration[3]}`;
  lines.push(
    "",
    `${title}: ${summary.findings} finding${summary.findings === 1 ? "" : "s"} in ${summary.files} file${summary.files === 1 ? "" : "s"} (${gens}). Catalogue ${report.catalogueVersion}.`,
  );
  return lines.join("\n").replace(/^\n/, "");
}
