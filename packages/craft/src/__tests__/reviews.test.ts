import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CATALOGUE, applyHouseGate, checkCopy, runTell, scanSource, tellById } from "../character/check.js";
import { REVIEW_VERDICTS, type DesignReview } from "../direction/types.js";
import { CORPUS, corpusPath, manifest } from "./corpus.js";

/**
 * The reviewer corpus (`reviews/` in the private dd-craft-corpus repo): each
 * file is one person's review, kept whole, in the design-review shape. This
 * binds it to the schema, to CHARACTER.md, and to the tells it taught, so a
 * review cannot be filed and then forgotten. Without the corpus, only the
 * schema checks run.
 */

const PKG = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel: string) => readFileSync(join(PKG, rel), "utf8");
const SCHEMA = JSON.parse(read("design-review.schema.json"));
const CHARACTER = read("CHARACTER.md");

type Schema = Record<string, unknown>;

/** Enough JSON Schema for this file: type, required, enum, const, minLength, minimum, pattern, properties, items, $ref. craft has no dependencies, so no validator package. */
function validate(value: unknown, schema: Schema, at = "$"): string[] {
  if (typeof schema.$ref === "string") {
    const name = schema.$ref.replace("#/$defs/", "");
    return validate(value, (SCHEMA.$defs as Record<string, Schema>)[name], at);
  }
  const errors: string[] = [];
  const types = schema.type === undefined ? [] : ([] as unknown[]).concat(schema.type);
  const typeOf = (v: unknown) => (Array.isArray(v) ? "array" : v === null ? "null" : Number.isInteger(v) ? "integer" : typeof v);
  if (types.length > 0 && !types.some((t) => t === typeOf(value) || (t === "number" && typeof value === "number"))) {
    return [`${at}: expected ${types.join(" or ")}, got ${typeOf(value)}`];
  }
  if (schema.const !== undefined && value !== schema.const) errors.push(`${at}: expected ${JSON.stringify(schema.const)}`);
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) errors.push(`${at}: ${JSON.stringify(value)} is not one of ${schema.enum.join(", ")}`);
  if (typeof value === "string") {
    if (typeof schema.minLength === "number" && value.length < schema.minLength) errors.push(`${at}: too short`);
    if (typeof schema.pattern === "string" && !new RegExp(schema.pattern).test(value)) errors.push(`${at}: does not match ${schema.pattern}`);
  }
  if (typeof value === "number" && typeof schema.minimum === "number" && value < schema.minimum) errors.push(`${at}: below ${schema.minimum}`);
  if (Array.isArray(value) && schema.items) value.forEach((v, i) => errors.push(...validate(v, schema.items as Schema, `${at}[${i}]`)));
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    for (const key of (schema.required as string[] | undefined) ?? []) if (!(key in obj)) errors.push(`${at}.${key}: required`);
    const props = (schema.properties as Record<string, Schema> | undefined) ?? {};
    for (const [key, v] of Object.entries(obj)) if (props[key]) errors.push(...validate(v, props[key], `${at}.${key}`));
  }
  return errors;
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith(".json") ? [path] : [];
  });
}

type ReviewRecord = DesignReview & { reviewer?: string; date?: string; source?: { canvas?: number } };
const REVIEWS_DIR = CORPUS ? corpusPath(manifest().reviews) : null;
const RECORDS = REVIEWS_DIR ? files(REVIEWS_DIR).map((path) => ({ path, review: JSON.parse(readFileSync(path, "utf8")) as ReviewRecord })) : [];
/** The first review in the corpus: the studio's own site, 2026-10-19, Pastel canvas 986559. Found by date and canvas, not by name. */
const FIRST = RECORDS.find((c) => c.review.date === "2026-10-19" && c.review.source?.canvas === 986559)?.review ?? null;
const byComment = (n: number) => FIRST!.notes.find((x) => x.source?.comment === n)!;

describe("design-review.schema.json, extended for a reviewer's own record", () => {
  it("still accepts the shipped review fixture, so the extension is compatible", () => {
    const fixture = JSON.parse(readFileSync(new URL("./fixtures/confidence/calibration-review.json", import.meta.url), "utf8"));
    expect(validate(fixture, SCHEMA)).toEqual([]);
  });

  it("rejects what it should, so the check is not vacuous", () => {
    const bad = { version: 1, subject: "x", notes: [{ id: "a", lens: "action", raisedBy: "r", basis: "observed", evidence: [], recommend: { class: "no-change" }, verdict: "maybe", principle: "Not An Id" }] };
    expect(validate(bad, SCHEMA)).toEqual([
      "$.notes[0].observation: required",
      '$.notes[0].verdict: "maybe" is not one of praise, take, take-reworded, partly, decline, founder-decision, known',
      "$.notes[0].principle: does not match ^[a-z0-9]+(?:-[a-z0-9]+)*$",
    ]);
  });

  it("names the verdicts the types name", () => {
    expect(SCHEMA.$defs.note.properties.verdict.enum).toEqual([...REVIEW_VERDICTS]);
  });

  it.skipIf(!CORPUS).each(RECORDS.map((c) => [c.path.replace(REVIEWS_DIR ?? "", "reviews"), c.review] as const))("%s is valid", (_path, review) => {
    expect(validate(review, SCHEMA)).toEqual([]);
    const ids = review.notes.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const n of review.notes) expect(n.verdict, n.id).toBeDefined();
  });
});

describe.skipIf(!CORPUS)("the review of the studio's own site, 2026-10-19 (Pastel 986559)", () => {
  const REVIEW = FIRST!;
  it("is in the corpus", () => {
    expect(FIRST).not.toBeNull();
  });

  it("keeps all 73 comments, once each, as the reviewer wrote them", () => {
    expect(REVIEW.notes).toHaveLength(73);
    expect(REVIEW.notes.map((n) => n.source?.comment)).toEqual(Array.from({ length: 73 }, (_, i) => i + 1));
    expect(REVIEW.reviewer).toBeTruthy();
    for (const n of REVIEW.notes) {
      expect(n.raisedBy).toBe(REVIEW.reviewer);
      expect(n.source).toMatchObject({ tool: "pastel", canvas: 986559 });
      expect(n.observation.length, n.id).toBeGreaterThan(0);
    }
  });

  it("records what was done with each note", () => {
    const count = (v: string) => REVIEW.notes.filter((n) => n.verdict === v).length;
    expect(Object.fromEntries(REVIEW_VERDICTS.map((v) => [v, count(v)]))).toEqual({
      praise: 12,
      take: 34,
      "take-reworded": 13,
      partly: 3,
      decline: 2,
      "founder-decision": 7,
      known: 2,
    });
    // A founder decision always carries the ruling.
    for (const n of REVIEW.notes.filter((x) => x.verdict === "founder-decision")) expect(n.founderRuling, n.id).toBeDefined();
  });

  it("writes up every principle it derives in CHARACTER.md", () => {
    const section = CHARACTER.split("### Review of the studio's own site, 2026-10-19")[1]?.split("\n### ")[0] ?? "";
    const principles = [...new Set(REVIEW.notes.flatMap((n) => (n.principle ? [n.principle] : [])))];
    expect(principles.length).toBeGreaterThanOrEqual(10);
    for (const p of principles) expect(section, p).toContain(`\`${p}\``);
  });

  it("fires each tell it taught on the words the reviewer flagged", () => {
    const taught = REVIEW.notes.flatMap((n) => (n.tells ?? []).map((t) => ({ ...t, note: n.id })));
    expect(new Set(taught.map((t) => t.id))).toEqual(new Set(["hero-cta-pair", "confession-line", "plain-english", "no-x-no-y", "review-phrase"]));
    for (const t of taught) {
      const tell = tellById(t.id);
      expect(tell, t.id).toBeDefined();
      if (t.text) expect(runTell(tell!, [{ path: "content/x.md", text: t.text }]).length, `${t.note} ${t.id}`).toBeGreaterThan(0);
    }
    expect(CATALOGUE.map((t) => t.id)).toEqual(expect.arrayContaining(["hero-cta-pair", "confession-line"]));
  });

  it("still copy-checks the reviewer's own wording: the diagnosis is taken, the words are not exempt", () => {
    const blocked = REVIEW.notes
      .filter((n) => applyHouseGate(checkCopy([{ path: "content/x.md", text: n.observation }])).summary.blocking > 0)
      .map((n) => n.source!.comment);
    // Four blocked at catalogue 2026.10.4, when the review was read; the plain-English family adds four.
    expect(blocked).toEqual(expect.arrayContaining([12, 13, 39, 42, 43, 48, 49, 59]));
    expect(byComment(42).verdict).toBe("take-reworded");
  });

  it("is right that the null build pairs two buttons in every hero (#5, #36)", () => {
    const dir = corpusPath(manifest().nullPages);
    const pages = readdirSync(dir).flatMap((brief) => {
      const p = join(dir, brief, "pages");
      try {
        return readdirSync(p).filter((f) => f.endsWith(".html")).map((f) => ({ path: `${brief}/${f}`, text: readFileSync(join(p, f), "utf8") }));
      } catch {
        return [];
      }
    });
    expect(pages).toHaveLength(140);
    const paired = pages.filter((page) => scanSource([page], { only: ["hero-cta-pair"] }).findings.length > 0);
    expect(paired).toHaveLength(140);
  });
});
