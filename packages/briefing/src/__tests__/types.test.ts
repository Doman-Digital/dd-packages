import { describe, expectTypeOf, it } from "vitest";
import type { Briefing, BuildResult, ClientConfig, RawInput, Search, Section, SparseBriefing, SparseBuildResult, SparseRawInput } from "../index";
import { buildBriefing } from "../index";

describe("types", () => {
  it("buildBriefing returns the briefing, the flags and the log", () => {
    const complete = (input: RawInput, config: ClientConfig) => buildBriefing(input, config);
    expectTypeOf(complete).returns.toEqualTypeOf<BuildResult>();
    expectTypeOf<BuildResult>().toHaveProperty("briefing").toEqualTypeOf<Briefing>();
    expectTypeOf<BuildResult>().toHaveProperty("flags");
    expectTypeOf<BuildResult>().toHaveProperty("log");
  });

  it("sparse inputs require consumers to guard missing metrics", () => {
    const sparse = (input: SparseRawInput, config: ClientConfig) => buildBriefing(input, config);
    expectTypeOf(sparse).returns.toEqualTypeOf<SparseBuildResult>();
    expectTypeOf<SparseBriefing>().not.toExtend<Briefing>();
    expectTypeOf<SparseBriefing["health"]["uptime"]>().toEqualTypeOf<Briefing["health"]["uptime"] | undefined>();
    expectTypeOf<SparseBriefing["health"]["search"]>().toEqualTypeOf<Search | undefined>();
    // This is the contract of a legacy renderer such as dd-relay's adapter.
    const legacyRenderer = (briefing: Briefing) => briefing.health.uptime.passed;
    const rejectsSparse = (briefing: SparseBriefing) => {
      // @ts-expect-error A sparse briefing cannot enter an unchecked complete-input renderer.
      legacyRenderer(briefing);
    };
    expectTypeOf(rejectsSparse).toBeFunction();
  });

  it("the headline and the note are required strings on the config", () => {
    expectTypeOf<ClientConfig["headline"]>().toEqualTypeOf<string>();
    expectTypeOf<ClientConfig["note"]>().toEqualTypeOf<string>();
  });

  it("track record is opt-in", () => {
    expectTypeOf<ClientConfig["trackRecordEnabled"]>().toEqualTypeOf<boolean | undefined>();
  });

  it("search is a sentence or numbers, never both", () => {
    expectTypeOf<Extract<Search, { state: "low-data" }>>().not.toHaveProperty("clicks");
    expectTypeOf<Extract<Search, { state: "numbers" }>>().not.toHaveProperty("sentence");
  });

  it("needs you is a section", () => {
    expectTypeOf<"needs-you">().toExtend<Section>();
  });
});
