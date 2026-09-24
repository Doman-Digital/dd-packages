import { describe, expect, test } from "vitest";
import { validateRedirects } from "../redirects";
import type { RoutePolicyEntry } from "../policy";

// The failure this exists to catch: a rebuild moves /services/rewiring.html
// to /services/rewiring, the new site passes every page test, and the
// NICEIC register link and the local-paper feature both start returning 404.
// Nothing on the new site visits the old address, so nothing notices.
describe("validateRedirects — the migration that loses its backlinks", () => {
  const routesOnDisk = ["/", "/services/rewiring", "/contact"];

  test("flags an externally linked old URL with neither a page nor a redirect", () => {
    const issues = validateRedirects({
      linkedUrls: ["https://example-electrical.co.uk/services/rewiring.html"],
      routesOnDisk,
      redirects: [],
    });
    expect(issues).toEqual([
      {
        kind: "linked-url-not-found",
        url: "https://example-electrical.co.uk/services/rewiring.html",
        path: "/services/rewiring.html",
      },
    ]);
  });

  test("a linked URL that still exists as a page needs no redirect", () => {
    expect(validateRedirects({ linkedUrls: ["/contact"], routesOnDisk, redirects: [] })).toEqual([]);
  });

  test("a linked URL covered by a redirect to a live page passes", () => {
    const issues = validateRedirects({
      linkedUrls: ["https://example-electrical.co.uk/services/rewiring.html"],
      routesOnDisk,
      redirects: [{ from: "/services/rewiring.html", to: "/services/rewiring" }],
    });
    expect(issues).toEqual([]);
  });

  test("compares paths, not strings: origin, query, fragment and a trailing slash do not matter", () => {
    const issues = validateRedirects({
      linkedUrls: [
        "https://www.example-electrical.co.uk/services/rewiring/?utm_source=echo#quote",
        "/contact/",
      ],
      routesOnDisk,
      redirects: [],
    });
    expect(issues).toEqual([]);
  });

  test("reports each missing path once, however many linking URLs point at it", () => {
    const issues = validateRedirects({
      linkedUrls: ["https://a.example/old", "https://a.example/old?ref=2", "/old/"],
      routesOnDisk,
      redirects: [],
    });
    expect(issues).toEqual([{ kind: "linked-url-not-found", url: "https://a.example/old", path: "/old" }]);
  });

  test("ignores linked URLs on hosts this site does not answer on, when hosts are given", () => {
    const issues = validateRedirects({
      linkedUrls: ["https://someone-else.co.uk/gone", "https://old-domain.co.uk/gone"],
      routesOnDisk,
      redirects: [],
      hosts: ["example-electrical.co.uk", "www.old-domain.co.uk"],
    });
    expect(issues).toEqual([{ kind: "linked-url-not-found", url: "https://old-domain.co.uk/gone", path: "/gone" }]);
  });

  test("a linked URL under a dynamic pattern in the policy counts as a page", () => {
    const policy: RoutePolicyEntry[] = [{ path: "/journal/*", indexable: true, inSitemap: false, isDynamicPattern: true }];
    const issues = validateRedirects({ linkedUrls: ["/journal/eicr-costs"], routesOnDisk, redirects: [], policy });
    expect(issues).toEqual([]);
  });

  test("reports an unparseable linked URL instead of throwing", () => {
    const issues = validateRedirects({ linkedUrls: ["not a url", "mailto:office@example.co.uk"], routesOnDisk, redirects: [] });
    expect(issues).toEqual([
      { kind: "linked-url-invalid", url: "not a url" },
      { kind: "linked-url-invalid", url: "mailto:office@example.co.uk" },
    ]);
  });
});

describe("validateRedirects — redirect hygiene", () => {
  const routesOnDisk = ["/", "/services", "/services/rewiring", "/thank-you"];

  test("flags a redirect whose target is not a page", () => {
    const issues = validateRedirects({ linkedUrls: [], routesOnDisk, redirects: [{ from: "/old", to: "/services/rewire" }] });
    expect(issues).toEqual([{ kind: "redirect-target-not-found", from: "/old", to: "/services/rewire" }]);
  });

  test("flags a chain and names every hop, so the first redirect can point straight at the end", () => {
    const issues = validateRedirects({
      linkedUrls: [],
      routesOnDisk,
      redirects: [
        { from: "/rewiring.html", to: "/rewiring" },
        { from: "/rewiring", to: "/services/rewiring" },
      ],
    });
    expect(issues).toEqual([
      { kind: "redirect-chain", from: "/rewiring.html", hops: ["/rewiring.html", "/rewiring", "/services/rewiring"] },
    ]);
  });

  test("flags a loop once, however many of its members are listed", () => {
    const issues = validateRedirects({
      linkedUrls: [],
      routesOnDisk,
      redirects: [
        { from: "/a", to: "/b" },
        { from: "/b", to: "/c" },
        { from: "/c", to: "/a" },
      ],
    });
    expect(issues).toEqual([{ kind: "redirect-loop", hops: ["/a", "/b", "/c"] }]);
  });

  test("flags a redirect from a path that is still a live page", () => {
    const issues = validateRedirects({ linkedUrls: [], routesOnDisk, redirects: [{ from: "/services", to: "/services/rewiring" }] });
    expect(issues).toEqual([{ kind: "redirect-shadows-route", from: "/services" }]);
  });

  test("flags a redirect that sends link equity to a noindex page", () => {
    const policy: RoutePolicyEntry[] = [{ path: "/thank-you", indexable: false, inSitemap: false }];
    const issues = validateRedirects({ linkedUrls: [], routesOnDisk, redirects: [{ from: "/old-form", to: "/thank-you" }], policy });
    expect(issues).toEqual([{ kind: "redirect-to-noindex", from: "/old-form", to: "/thank-you" }]);
  });

  test("flags two redirects from the same path and follows the first", () => {
    const issues = validateRedirects({
      linkedUrls: [],
      routesOnDisk,
      redirects: [
        { from: "/old", to: "/services" },
        { from: "/old/", to: "/services/rewiring" },
      ],
    });
    expect(issues).toEqual([{ kind: "duplicate-redirect", from: "/old", to: ["/services", "/services/rewiring"] }]);
  });

  test("accepts an external destination without a page check", () => {
    const issues = validateRedirects({
      linkedUrls: ["/shop"],
      routesOnDisk,
      redirects: [{ from: "/shop", to: "https://shop.example.co.uk/" }],
    });
    expect(issues).toEqual([]);
  });

  test("a clean migration produces no issues", () => {
    const issues = validateRedirects({
      linkedUrls: ["https://example-electrical.co.uk/rewiring.html", "https://example-electrical.co.uk/"],
      routesOnDisk,
      redirects: [{ from: "/rewiring.html", to: "/services/rewiring", permanent: true, reason: "2026 rebuild" }],
      hosts: ["example-electrical.co.uk"],
    });
    expect(issues).toEqual([]);
  });

  test("returns linked-URL issues first, then redirect issues, each in input order", () => {
    const issues = validateRedirects({
      linkedUrls: ["/missing-two", "/missing-one"],
      routesOnDisk,
      redirects: [
        { from: "/z", to: "/nowhere" },
        { from: "/a", to: "/also-nowhere" },
      ],
    });
    expect(issues.map((i) => i.kind + ":" + ("path" in i ? i.path : "from" in i ? i.from : ""))).toEqual([
      "linked-url-not-found:/missing-two",
      "linked-url-not-found:/missing-one",
      "redirect-target-not-found:/z",
      "redirect-target-not-found:/a",
    ]);
  });
});

describe("validateRedirects — reading linked URLs", () => {
  test("handles ports, credentials, upper-case hosts and a bare origin", () => {
    const issues = validateRedirects({
      linkedUrls: ["HTTPS://WWW.Example-Electrical.co.uk:443", "https://user@example-electrical.co.uk/contact"],
      routesOnDisk: ["/", "/contact"],
      redirects: [],
      hosts: ["example-electrical.co.uk"],
    });
    expect(issues).toEqual([]);
  });

  test("rejects a scheme other than http or https, and a URL with no host", () => {
    const issues = validateRedirects({ linkedUrls: ["ftp://example.co.uk/file", "https:///nohost"], routesOnDisk: [], redirects: [] });
    expect(issues.map((i) => i.kind)).toEqual(["linked-url-invalid", "linked-url-invalid"]);
  });
});
