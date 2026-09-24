// The ranges a new site installs must be satisfied by the house packages as
// they will be published: the workspace version, bumped by any changeset
// waiting in .changeset/. When seo moves to 0.3.0, this fails and forces the
// scaffold's range to follow.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { HOUSE_DEPENDENCIES, HOUSE_DEV_DEPENDENCIES } from "../versions";
import { PACKAGE_ROOT } from "./fixtures";

const REPO = join(PACKAGE_ROOT, "..", "..");

function pendingBump(name: string): "major" | "minor" | "patch" | null {
  const order = ["patch", "minor", "major"] as const;
  let bump: (typeof order)[number] | null = null;
  for (const file of readdirSync(join(REPO, ".changeset")).filter((f) => f.endsWith(".md") && f !== "README.md")) {
    const m = new RegExp(`"${name.replace("/", "\\/")}":\\s*(major|minor|patch)`).exec(readFileSync(join(REPO, ".changeset", file), "utf8"));
    if (m && (!bump || order.indexOf(m[1] as (typeof order)[number]) > order.indexOf(bump))) bump = m[1] as (typeof order)[number];
  }
  return bump;
}

function publishedVersion(name: string): [number, number, number] {
  const dir = name.split("/")[1]!;
  const [major, minor, patch] = (JSON.parse(readFileSync(join(REPO, "packages", dir, "package.json"), "utf8")) as { version: string }).version
    .split(".")
    .map(Number) as [number, number, number];
  const bump = pendingBump(name);
  // Changesets bumps a 0.x package's minor for "minor" and "major" alike only
  // when configured to; by default a major goes to 1.0.0.
  if (bump === "major") return [major + 1, 0, 0];
  if (bump === "minor") return [major, minor + 1, 0];
  if (bump === "patch") return [major, minor, patch + 1];
  return [major, minor, patch];
}

function satisfiesCaret(range: string, [major, minor, patch]: [number, number, number]): boolean {
  const [rMajor, rMinor, rPatch] = range.replace(/^\^/, "").split(".").map(Number) as [number, number, number];
  if (rMajor > 0) return major === rMajor && (minor > rMinor || (minor === rMinor && patch >= rPatch));
  return major === 0 && minor === rMinor && patch >= rPatch;
}

describe("house package ranges", () => {
  const house = Object.entries({ ...HOUSE_DEPENDENCIES, ...HOUSE_DEV_DEPENDENCIES }).filter(([name]) => name.startsWith("@domandigital/"));

  for (const [name, range] of house) {
    test(`${name}@${range} is satisfied by what will be published`, () => {
      expect(satisfiesCaret(range, publishedVersion(name))).toBe(true);
    });
  }
});
