// next.config serves exactly the redirects in redirects.json. Written by
// @domandigital/create-site; fails until the config reads redirects.json.

import { describe, expect, test } from "vitest";
import type { RedirectsFile } from "@domandigital/seo";
import nextConfig from "~site/framework-config";
import redirectsFile from "~site/redirects.json";

describe("next.config redirects", () => {
  test("serves every redirect in redirects.json, and nothing else", async () => {
    const served = (await nextConfig.redirects?.()) ?? [];
    const listed = (redirectsFile as RedirectsFile).redirects;
    expect(served.map((r) => [r.source, r.destination])).toEqual(listed.map((r) => [r.from, r.to]));
  });
});
