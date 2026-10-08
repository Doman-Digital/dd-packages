import { describe, expect, it } from "vitest";
import { classifyEntries } from "../classify";
import { dedupe } from "../dedupe";
import { maintenanceLine, MAX_CHANGES, rankChanges, SECURITY_FALLBACK } from "../rank";
import { briefingBlock, entry } from "./helpers";
import type { RawEntry } from "../types";

const live = (...entries: RawEntry[]) => dedupe(classifyEntries(entries)).groups.filter((g) => g.bucket === "live");
const image = "image: https://img.example/home.png | The home page on a phone";

describe("order and caps", () => {
  it("ranks visible, then security, then privacy, then everything else", () => {
    const { shown, overflow } = rankChanges(
      live(
        entry(1, "Daily reminder", "Each morning you'll get one email listing orders."),
        entry(2, "Analytics", "If a visitor accepts analytics, your site measures page views without cookies."),
        entry(3, "fix(deps): next", "This is a security update."),
        entry(4, "perf: home", "Phones load your home page faster."),
      ),
    );
    expect([...shown, ...overflow].map((c) => c.kind)).toEqual(["visible", "security", "privacy", "other"]);
  });

  it(`shows at most ${MAX_CHANGES}; the rest overflow to the log`, () => {
    const lines = [
      "Visitors see a gallery of your photographs.",
      "Your contact form asks for a phone number.",
      "Phones open your menu faster.",
      "Your footer shows opening times.",
      "Your shop page lists prices beside each item.",
    ];
    const { shown, overflow } = rankChanges(live(...lines.map((line, i) => entry(i + 1, `feat: change ${i + 1}`, line, { body: briefingBlock("kind: visible") }))));
    expect(shown).toHaveLength(3);
    expect(overflow).toHaveLength(2);
    // Latest first within a kind.
    expect(shown.map((c) => c.id.split("#")[1])).toEqual(["5", "4", "3"]);
  });

  it("splits a plain line into title and outcome, and a security group with no line gets the house wording", () => {
    const [c] = rankChanges(live(entry(1, "perf: home", "Your home page opens faster on phones. The intro video is skipped."))).shown;
    expect(c).toMatchObject({ title: "Your home page opens faster on phones", outcome: "The intro video is skipped." });
    const [s] = rankChanges(live(entry(2, "chore(deps): pnpm (security)"))).shown;
    expect(s).toMatchObject(SECURITY_FALLBACK);
  });
});

describe("feature image", () => {
  it("goes above the top change when it is visible and has one", () => {
    const r = rankChanges(live(entry(1, "perf: home", "Phones load your home page faster.", { body: briefingBlock(`kind: visible\n${image}`) })));
    expect(r.featureImage).toEqual({ url: "https://img.example/home.png", alt: "The home page on a phone" });
  });

  it("is omitted when the top change has none: never a weaker change because it has a picture", () => {
    const r = rankChanges(
      live(
        entry(1, "perf: home", "Phones load your home page faster."),
        entry(2, "feat: gallery", "Visitors see a new gallery page of photos.", { body: briefingBlock(`kind: visible\n${image}`) }),
        entry(3, "perf: menu", "Phones open your menu faster."),
      ),
    );
    expect(r.shown[0]!.id.endsWith("#3")).toBe(true);
    expect(r.featureImage).toBeUndefined();
    expect(r.shown.find((c) => c.id.endsWith("#2"))!.image).toBeDefined();
  });

  it("is omitted when the top change is not visible, and non-visible changes never carry one", () => {
    const r = rankChanges(live(entry(1, "fix(deps): next", "This is a security update.", { body: briefingBlock(`kind: security\n${image}`) })));
    expect(r.featureImage).toBeUndefined();
    expect(r.shown[0]!.image).toBeUndefined();
  });

  it("is omitted with no live change at all", () => {
    expect(rankChanges([])).toEqual({ shown: [], overflow: [] });
  });
});

describe("maintenance collapse", () => {
  it("is a count, never a list", () => {
    expect(maintenanceLine(14)).toBe("Plus 14 maintenance tasks behind the scenes.");
    expect(maintenanceLine(1)).toBe("Plus 1 maintenance task behind the scenes.");
    expect(maintenanceLine(0)).toBe("");
  });

  it("counts live changes past the cap rather than hiding them", () => {
    expect(maintenanceLine(14, 2)).toBe("Plus 2 more changes and 14 maintenance tasks behind the scenes.");
    expect(maintenanceLine(0, 1)).toBe("Plus 1 more change.");
  });
});
