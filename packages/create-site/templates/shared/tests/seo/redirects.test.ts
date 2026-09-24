// The migration gate: every URL another site links to still lands on a page,
// in one hop. Record earned links in links.json and moved URLs in
// redirects.json. Written by @domandigital/create-site.

import { describe, expect, test } from "vitest";
import { liveLinkedUrls, validateRedirects } from "@domandigital/seo";
import type { BacklinkRegister, RedirectsFile } from "@domandigital/seo";
import { facts } from "~site/facts";
import links from "~site/links.json";
import redirectsFile from "~site/redirects.json";
import { policy } from "~site/routes";
import { routesOnDisk } from "~site/routes-on-disk";

describe("redirects", () => {
  test("every linked URL resolves, with no chains, loops or dead targets", () => {
    const issues = validateRedirects({
      linkedUrls: liveLinkedUrls(links as BacklinkRegister),
      routesOnDisk: routesOnDisk(),
      redirects: (redirectsFile as RedirectsFile).redirects,
      policy,
      hosts: [new URL(facts.url).hostname, ...facts.previousHosts],
    });
    expect(issues).toEqual([]);
  });
});
