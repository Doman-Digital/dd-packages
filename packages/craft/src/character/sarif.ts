/**
 * A report as SARIF 2.1.0, for GitHub code scanning and any other tool that
 * reads it. Pure.
 *
 * One rule per tell the report names, carrying the tell's `why` and `fix`.
 * `block` findings are errors, `warn` findings warnings. A finding on a
 * rendered page has the URL as its location and no line: GitHub code
 * scanning only shows results in files of the repo, so those appear in the
 * SARIF file but not in the Security tab.
 */

import { findingKey, fnv1a } from "./baseline.js";
import type { CheckReport } from "./types.js";

export interface SarifTell {
  id: string;
  name: string;
  why: string;
  fix: string;
}

export interface SarifOptions {
  /** The catalogue, for each rule's description. */
  tells: readonly SarifTell[];
  /** Where a reader learns more. */
  informationUri?: string;
}

const isUrl = (path: string): boolean => /^[a-z][a-z0-9+.-]*:\/\//i.test(path);

export function toSarif(report: CheckReport, options: SarifOptions) {
  const byId = new Map(options.tells.map((t) => [t.id, t]));
  const ids = [...new Set(report.findings.map((f) => f.tell))].sort();
  const index = new Map(ids.map((id, i) => [id, i]));
  const rules = ids.map((id) => {
    const t = byId.get(id);
    return {
      id,
      name: t?.name ?? id,
      shortDescription: { text: t?.name ?? id },
      ...(t ? { fullDescription: { text: t.why }, help: { text: t.fix } } : {}),
    };
  });
  const results = report.findings.map((f) => ({
    ruleId: f.tell,
    ruleIndex: index.get(f.tell)!,
    level: f.severity === "block" ? ("error" as const) : ("warning" as const),
    message: { text: `${f.message}. ${f.fix}` },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: isUrl(f.path) ? f.path : f.path.replace(/\\/g, "/") },
          ...(f.line > 0 ? { region: { startLine: f.line, snippet: { text: f.excerpt } } } : {}),
        },
      },
    ],
    partialFingerprints: { "craftFinding/v1": fnv1a(findingKey(f)) },
  }));
  return {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0" as const,
    runs: [
      {
        tool: {
          driver: {
            name: "craft",
            version: report.catalogueVersion,
            informationUri: options.informationUri ?? "https://www.npmjs.com/package/@domandigital/craft",
            rules,
          },
        },
        results,
      },
    ],
  };
}
