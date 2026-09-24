// astro.config serves exactly the redirects in redirects.json. Written by
// @domandigital/create-site; fails until the config reads redirects.json.
//
// Static output turns these into meta-refresh pages, not real 301s. For a
// migration, deploy with a host adapter or add host-level redirects.

import { describe, expect, test } from "vitest";
import type { RedirectsFile } from "@domandigital/seo";
import config from "~site/framework-config";
import redirectsFile from "~site/redirects.json";

describe("astro.config redirects", () => {
  test("serves every redirect in redirects.json, and nothing else", () => {
    const served = Object.entries(config.redirects ?? {}).map(([from, r]) => [from, typeof r === "string" ? r : r.destination]);
    const listed = (redirectsFile as RedirectsFile).redirects;
    expect(served).toEqual(listed.map((r) => [r.from, r.to]));
  });
});
