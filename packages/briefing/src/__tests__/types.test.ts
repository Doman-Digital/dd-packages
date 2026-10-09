import { describe, expectTypeOf, it } from "vitest";
import type { Briefing, BuildResult, ClientConfig, Search, Section } from "../index";
import { buildBriefing } from "../index";

describe("types", () => {
  it("buildBriefing returns the briefing, the flags and the log", () => {
    expectTypeOf(buildBriefing).returns.toEqualTypeOf<BuildResult>();
    expectTypeOf<BuildResult>().toHaveProperty("briefing").toEqualTypeOf<Briefing>();
    expectTypeOf<BuildResult>().toHaveProperty("flags");
    expectTypeOf<BuildResult>().toHaveProperty("log");
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
