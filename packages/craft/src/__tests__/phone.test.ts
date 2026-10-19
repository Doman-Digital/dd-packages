import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run } from "../character/cli.js";
import { checkExceptions, judgeGrowth, judgeMeasured, judgeRoutes, judgeStatic, normaliseElement, parseBaseline, routeMatches, routesFromManifest, routesFromPages, scanPhoneFirst, writeBaseline, type Baseline, type MeasuredRoute } from "../phone/judge.js";
import { measurePhone, PHONE, routeFile } from "../phone/index.js";

const file = (path: string, text: string) => ({ path, text });
const none: Baseline = { static: [], measured: [] };

describe("scanPhoneFirst", () => {
  it("finds max-width queries in every spelling, and max-* variants", () => {
    const { findings } = scanPhoneFirst([
      file("a.css", "@media (max-width: 767px) { .a { display: block } }\n@media (width < 40rem) {}\n@media (600px > width) {}\n@custom-media --narrow (max-width: 30em);"),
      file("B.tsx", `<div className="flex max-md:flex-col max-[40rem]:hidden" />`),
    ]);
    expect(findings.map((f) => `${f.file}:${f.line} ${f.what}`)).toEqual([
      "a.css:1 @media (max-width: 767px)",
      "a.css:2 @media (width < 40rem)",
      "a.css:3 @media (600px > width)",
      "a.css:4 @custom-media --narrow (max-width: 30em)",
      "B.tsx:1 max-md:",
      "B.tsx:1 max-[40rem]:",
    ]);
  });

  it("leaves min-width, max-width as a property and max-* utilities alone", () => {
    const { findings } = scanPhoneFirst([
      file("a.css", "@media (min-width: 768px) { .a { max-width: 40rem } }\n.b { max-height: 2rem }"),
      file("B.tsx", `<p className="max-w-prose max-h-40 sm:max-w-md md:grid">x</p>`),
    ]);
    expect(findings).toEqual([]);
  });

  it("excuses a rule with a reason, on its line or the line above, and a file with one", () => {
    const { findings, excused } = scanPhoneFirst(
      [
        file("a.css", "/* mobile-first-ok: print sheet keeps the desktop table */\n@media (max-width: 600px) {}\n@media (max-width: 500px) {} /* mobile-first-ok: */"),
        file("b.css", "@media (max-width: 600px) {}"),
      ],
      [{ file: "b.css", reason: "third-party widget skin, replaced in DOM-720" }],
    );
    expect(excused).toBe(1);
    expect(findings).toEqual([{ file: "a.css", line: 3, what: "@media (max-width: 500px) (mobile-first-ok with no reason)" }]);
  });

  it("names each faulty exception: the file or the reason left out, or a file that is gone", () => {
    expect(checkExceptions([{ reason: "x" }, { file: "a.css" }, { file: "gone.css", reason: "x" }, { file: "a.css", reason: "x" }], (f) => f === "a.css")).toEqual([
      "exceptions[0]: names no file",
      "exceptions[1] (a.css): no reason. Say why this file needs a max-width query, or remove the exception.",
      "exceptions[2]: gone.css is not there. Remove the exception.",
    ]);
  });
});

describe("the baseline", () => {
  const two = [
    { file: "a.css", line: 1, what: "@media (max-width: 600px)" },
    { file: "a.css", line: 9, what: "@media (max-width: 900px)" },
  ];

  it("lets known breaches through and counts them", () => {
    expect(judgeStatic(two, { static: [{ file: "a.css", count: 2 }], measured: [] })).toEqual({ fresh: [], stale: [], known: 2 });
  });

  it("fails a new breach, in a new file or above a file's count", () => {
    expect(judgeStatic(two, none).fresh).toHaveLength(1);
    const over = judgeStatic(two, { static: [{ file: "a.css", count: 1 }], measured: [] });
    expect(over.fresh[0]).toMatch(/2 desktop-first rules, the baseline allows 1/);
    expect(over.known).toBe(1);
  });

  it("fails a count higher than what is there, so it only shrinks", () => {
    const { stale } = judgeStatic(two.slice(0, 1), { static: [{ file: "a.css", count: 2 }, { file: "gone.css", count: 1 }], measured: [] });
    expect(stale).toEqual(["a.css: the baseline allows 2, there is 1 now. Lower it to 1.", "gone.css: the baseline allows 1, there are 0 now. Lower it to 0 (remove the line)."]);
  });

  const routes: MeasuredRoute[] = [
    {
      route: "/portal",
      findings: [
        { check: "target", element: `<a> "Invoice 1042"`, detail: "80x20px, under 44x44" },
        { check: "target", element: `<a> "Invoice 1043"`, detail: "80x20px, under 44x44" },
        { check: "scroll", element: "<html>", detail: "the page is 412px wide at 375px" },
      ],
    },
  ];

  it("keys measured breaches on route, check and element, with digits folded", () => {
    expect(normaliseElement(`<a> "Invoice 1042, £1,200.00"`)).toBe(`<a> "Invoice #, £#,#.#"`);
    expect(normaliseElement(`<h1> "Step 2 of 3"`)).toBe(`<h1> "Step # of #"`);
    expect(normaliseElement("<h2>")).toBe("<h2>");
    const baseline = writeBaseline([], routes);
    expect(baseline.measured).toEqual([
      { route: "/portal", check: "scroll", element: "<html>", count: 1 },
      { route: "/portal", check: "target", element: `<a> "Invoice #"`, count: 2 },
    ]);
    expect(judgeMeasured(routes, baseline)).toEqual({ fresh: [], stale: [], known: 3 });
  });

  it("fails a new measured breach and an extra one of a known kind", () => {
    const baseline: Baseline = { static: [], measured: [{ route: "/portal", check: "target", element: `<a> "Invoice #"`, count: 1 }] };
    const { fresh, known } = judgeMeasured(routes, baseline);
    expect(fresh).toEqual([`/portal: small target <a> "Invoice 1042": 80x20px, under 44x44 (2 found, the baseline allows 1)`, "/portal: scrolls sideways <html>: the page is 412px wide at 375px"]);
    expect(known).toBe(1);
  });

  it("fails a route the baseline names that was not measured, once", () => {
    const baseline: Baseline = {
      static: [],
      measured: [
        { route: "/admin", check: "text", element: `<span> "Draft"`, count: 1 },
        { route: "/admin", check: "field", element: "<input>", count: 1 },
      ],
    };
    expect(judgeMeasured(routes, baseline).stale).toEqual(["/admin: in the baseline but not measured this run. Measure it, or remove its lines."]);
  });
});


describe("the baseline only shrinks (DOM-1053)", () => {
  const base: Baseline = {
    static: [{ file: "a.css", count: 2 }],
    measured: [{ route: "/portal", check: "target", element: '<a> "Pay"', count: 1 }],
  };

  it("passes a baseline that is the same or smaller", () => {
    expect(judgeGrowth(base, base)).toEqual([]);
    expect(judgeGrowth({ static: [{ file: "a.css", count: 1 }], measured: [] }, base)).toEqual([]);
  });

  it("fails a new entry and a higher count, static and measured", () => {
    const grown: Baseline = {
      static: [{ file: "a.css", count: 3 }, { file: "b.css", count: 1 }],
      measured: [
        { route: "/portal", check: "target", element: '<a> "Pay"', count: 2 },
        { route: "/portal/new", check: "text", element: '<p> "Hi"', count: 1 },
      ],
    };
    expect(judgeGrowth(grown, base)).toEqual([
      "a.css: 3 desktop-first rules, main allows 2",
      "b.css: 1 desktop-first rule added to the baseline",
      '/portal: small target <a> "Pay": 2 in the baseline, main allows 1',
      '/portal/new: small text <p> "Hi": added to the baseline (1)',
    ]);
  });

  it("lets an entry with a reason in or up: a named exception", () => {
    const named: Baseline = {
      static: [{ file: "a.css", count: 2 }],
      measured: [
        { route: "/portal", check: "target", element: '<a> "Pay"', count: 1 },
        { route: "/admin/content", check: "text", element: '<p> "Studio"', count: 14, reason: "Sanity Studio's sign-in dialog, third-party UI" },
      ],
    };
    expect(judgeGrowth(named, base)).toEqual([]);
    expect(judgeGrowth({ ...named, measured: [{ ...named.measured[0], count: 4, reason: "  " }] }, base)).toHaveLength(1);
  });

  it("reads an old baseline, and refuses a reason that is not text", () => {
    expect(parseBaseline({ note: "n", static: [{ file: "a", count: 1, found: ["x"] }] }, "b.json")).toEqual({ note: "n", static: [{ file: "a", count: 1, found: ["x"] }], measured: [] });
    expect(parseBaseline({}, "b.json")).toEqual({ static: [], measured: [] });
    expect(() => parseBaseline({ static: [{ file: "a", count: 1, reason: 3 }] }, "b.json")).toThrow(/b\.json: an entry has a "reason" that is not text/);
  });

  it("keeps a reason when the baseline is rewritten", () => {
    const previous: Baseline = {
      static: [{ file: "a.css", count: 1, reason: "print sheet" }],
      measured: [{ route: "/admin", check: "text", element: '<p> "Studio"', count: 5, reason: "third-party" }],
    };
    const next = writeBaseline(
      [{ file: "a.css", line: 1, what: "@media (max-width: 1px)" }],
      [{ route: "/admin", findings: [{ check: "text", element: '<p> "Studio"', detail: "10px" }, { check: "text", element: '<p> "Studio"', detail: "10px" }] }],
      undefined,
      previous,
    );
    expect(next.static[0].reason).toBe("print sheet");
    expect(next.measured[0]).toMatchObject({ count: 2, reason: "third-party" });
  });
});

describe("every route is measured (DOM-1053)", () => {
  it("reads page routes from an app folder: groups, slots, private folders and intercepts are not URLs", () => {
    expect(
      routesFromPages([
        "page.tsx",
        "(marketing)/pricing/page.tsx",
        "portal/projects/[id]/page.tsx",
        "portal/@modal/page.tsx",
        "portal/@modal/(.)photo/[id]/page.tsx",
        "_components/page.tsx",
        "docs/[...slug]/page.mdx",
        "shop/[[...slug]]/page.js",
        "portal/layout.tsx",
        "api/route.ts",
      ]),
    ).toEqual(["/", "/docs/[...slug]", "/portal", "/portal/projects/[id]", "/pricing", "/shop/[[...slug]]"]);
  });

  it("reads page routes from Next's app-path-routes-manifest", () => {
    expect(routesFromManifest({ "/page": "/", "/portal/[id]/page": "/portal/[id]", "/api/x/route": "/api/x", "/_not-found/page": "/_not-found" })).toEqual(["/", "/portal/[id]"]);
  });

  it("matches a measured route to the page it opens, query and all", () => {
    expect(routeMatches("/portal/projects/[id]", "/portal/projects/p_1")).toBe(true);
    expect(routeMatches("/portal/projects/[id]", "/portal/projects/[id]")).toBe(true);
    expect(routeMatches("/portal/projects/[id]", "/portal/projects")).toBe(false);
    expect(routeMatches("/docs/[...slug]", "/docs")).toBe(false);
    expect(routeMatches("/docs/[...slug]", "/docs/a/b")).toBe(true);
    expect(routeMatches("/shop/[[...slug]]", "/shop")).toBe(true);
  });

  const pages = ["/", "/admin", "/portal/projects", "/portal/projects/[id]", "/portal/projects/new"];

  it("passes when every page is measured, ignoring the query", () => {
    const j = judgeRoutes(pages, ["/", "/admin?theme=dark", "/portal/projects", "/portal/projects/p1", "/portal/projects/new"]);
    expect(j).toEqual({ missing: [], problems: [], covered: 5 });
  });

  it("fails a page nothing measures, and a static page does not stand in for its dynamic sibling", () => {
    const j = judgeRoutes(pages, ["/", "/admin", "/portal/projects", "/portal/projects/new"]);
    expect(j.missing).toEqual(["/portal/projects/[id]"]);
  });

  it("is excluded only with a reason, for a page that exists", () => {
    const measured = ["/", "/admin", "/portal/projects/p1", "/portal/projects/new"];
    expect(judgeRoutes(pages, measured, [{ route: "/portal/projects", reason: "redirects to /portal" }])).toEqual({ missing: [], problems: [], covered: 5 });
    expect(judgeRoutes(pages, measured, [{ route: "/portal/projects", reason: " " }])).toMatchObject({ missing: ["/portal/projects"], problems: [expect.stringContaining("no reason")] });
    expect(judgeRoutes(pages, measured, [{ route: "/gone", reason: "old" }]).problems[0]).toMatch(/\/gone is not a page route/);
    // A trailing /* takes the prefix and everything under it.
    expect(judgeRoutes(["/", "/admin", "/admin/a", "/administer"], ["/"], [{ route: "/admin/*", reason: "operator tool, measured by hand" }]).missing).toEqual(["/administer"]);
  });
});

describe("Tailwind 3 var() opacity (DOM-1053)", () => {
  const v3 = () => true;
  const tsx = `<header className="fixed bg-[var(--bg-1)]/95 text-[color:var(--ink)]/70 bg-[var(--bg-2)]">x</header>
<div className="bg-[rgb(var(--x))]/50 bg-[#fff]/50 bg-white/90 bg-[var(--a)]">y</div>`;

  it("flags /NN on an arbitrary var() colour when the app is on Tailwind 3", () => {
    const { findings } = scanPhoneFirst([file("Bar.tsx", tsx)], [], { tailwind3: v3 });
    expect(findings.map((f) => `${f.line} ${f.what}`)).toEqual([
      "1 bg-[var(--bg-1)]/95 (Tailwind 3 emits no CSS for opacity on a var() colour)",
      "1 text-[color:var(--ink)]/70 (Tailwind 3 emits no CSS for opacity on a var() colour)",
    ]);
  });

  it("leaves it alone on Tailwind 4, or when the version is not known", () => {
    expect(scanPhoneFirst([file("Bar.tsx", tsx)]).findings).toEqual([]);
    expect(scanPhoneFirst([file("Bar.tsx", tsx)], [], { tailwind3: () => false }).findings).toEqual([]);
  });

  it("is not excused by a mobile-first-ok marker, since the class emits no CSS", () => {
    const { findings, excused } = scanPhoneFirst([file("Bar.tsx", `{/* mobile-first-ok: tint */}\n<i className="bg-[var(--x)]/10" />`)], [], { tailwind3: v3 });
    expect(findings).toHaveLength(1);
    expect(excused).toBe(0);
  });
});

describe("craft phone-first", () => {
  let dir: string;
  let out: string[];
  let err: string[];
  const io = () => ({ cwd: dir, out: (t: string) => out.push(t), err: (t: string) => err.push(t) });
  const write = (path: string, text: string): void => {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "craft-phone-"));
    out = [];
    err = [];
    write("phone-first.json", JSON.stringify({ source: ["app"], ignore: ["app/emails/**"] }));
    write("app/page.tsx", `<main className="p-4 md:p-8">x</main>`);
    write("app/emails/receipt.tsx", `<style>{"@media (max-width: 600px) {}"}</style>`);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("passes a phone-first source and skips ignored folders", async () => {
    expect(await run(["phone-first"], io())).toBe(0);
    expect(out.join("\n")).toMatch(/pass\. 1 files/);
  });

  it("fails a max-width rule, then passes once it is in the baseline, then asks for the baseline to shrink", async () => {
    write("app/old.css", "@media (max-width: 767px) { .t { display: block } }");
    expect(await run(["phone-first"], io())).toBe(1);
    expect(err.join("\n")).toMatch(/app\/old\.css:\n {4}line 1: @media \(max-width: 767px\)/);
    expect(await run(["phone-first", "--update-baseline"], io())).toBe(0);
    expect(JSON.parse(readFileSync(join(dir, "phone-first.baseline.json"), "utf8")).static).toEqual([{ file: "app/old.css", count: 1, found: ["@media (max-width: 767px)"] }]);
    expect(await run(["phone-first"], io())).toBe(0);
    expect(out.at(-1)).toMatch(/1 known breach in phone-first\.baseline\.json/);
    write("app/old.css", "@media (min-width: 768px) { .t { display: table } }");
    err = [];
    expect(await run(["phone-first"], io())).toBe(1);
    expect(err.join("\n")).toMatch(/Lower it to 0/);
  });

  it("judges measured routes against the baseline", async () => {
    const measured: MeasuredRoute = { route: "/portal", findings: [{ check: "field", element: "<input>", detail: "set at 14px, under 16px" }] };
    write(`phone-first/measured/${routeFile("/portal")}`, JSON.stringify(measured));
    write(`phone-first/measured/${routeFile("/")}`, JSON.stringify({ route: "/", findings: [] }));
    expect(await run(["phone-first", "--measured", "phone-first/measured"], io())).toBe(1);
    expect(err.join("\n")).toMatch(/Measured at 375px:\n {2}\/portal: small field <input>: set at 14px/);
    expect(await run(["phone-first", "--measured", "phone-first/measured", "--update-baseline"], io())).toBe(0);
    expect(await run(["phone-first", "--measured", "phone-first/measured"], io())).toBe(0);
    // The static run alone keeps the measured lines it did not judge.
    expect(await run(["phone-first", "--update-baseline"], io())).toBe(0);
    expect(JSON.parse(readFileSync(join(dir, "phone-first.baseline.json"), "utf8")).measured).toHaveLength(1);
  });

  it("refuses a missing config, a missing measured folder and an exception with no reason", async () => {
    rmSync(join(dir, "phone-first.json"));
    expect(await run(["phone-first"], io())).toBe(2);
    write("phone-first.json", JSON.stringify({ source: ["app"], exceptions: [{ file: "app/page.tsx" }] }));
    expect(await run(["phone-first", "--measured", "nowhere"], io())).toBe(2);
    expect(await run(["phone-first"], io())).toBe(1);
    expect(err.join("\n")).toMatch(/no reason/);
  });

  describe("the baseline against the base branch", () => {
    const git = (...args: string[]) => execFileSync("git", ["-c", "user.email=t@t", "-c", "user.name=t", ...args], { cwd: dir, encoding: "utf8" });
    const baseline = (entries: object[]) => write("phone-first.baseline.json", JSON.stringify({ static: [], measured: entries }));
    const entry = (element: string, extra = {}) => ({ route: "/", check: "text", element, count: 1, ...extra });
    const measure = (...elements: string[]) =>
      write(`phone-first/measured/${routeFile("/")}`, JSON.stringify({ route: "/", findings: elements.map((e) => ({ check: "text", element: e, detail: "10px, under 12px" })) }));
    const gate = () => run(["phone-first", "--measured", "phone-first/measured", "--base", "main"], io());

    beforeEach(() => {
      git("init", "-q", "-b", "main");
      measure('<p> "a"');
      baseline([entry('<p> "a"')]);
      git("add", "-A");
      git("commit", "-q", "-m", "gate");
      err = [];
    });

    it("passes the baseline as main has it, and one that shrank", async () => {
      expect(await gate()).toBe(0);
      git("checkout", "-q", "-b", "fix");
      measure();
      baseline([]);
      expect(await gate()).toBe(0);
    });

    it("fails an entry main does not have, even though the breach is really there", async () => {
      git("checkout", "-q", "-b", "pr");
      measure('<p> "a"', '<p> "b"');
      baseline([entry('<p> "a"'), entry('<p> "b"')]);
      expect(await gate()).toBe(1);
      expect(err.join("\n")).toMatch(/does not.*\n\s+\/: small text <p> "b": added to the baseline \(1\)/);
      expect(err.join("\n")).not.toMatch(/"a": added/);
    });

    it("lets an entry with a reason in", async () => {
      git("checkout", "-q", "-b", "pr");
      measure('<p> "a"', '<p> "studio"');
      baseline([entry('<p> "a"'), entry('<p> "studio"', { reason: "Sanity Studio sign-in, third-party UI" })]);
      expect(await gate()).toBe(0);
    });

    it("keeps a reason through --update-baseline", async () => {
      baseline([entry('<p> "a"', { reason: "third-party" })]);
      expect(await run(["phone-first", "--measured", "phone-first/measured", "--update-baseline"], io())).toBe(0);
      expect(JSON.parse(readFileSync(join(dir, "phone-first.baseline.json"), "utf8")).measured[0].reason).toBe("third-party");
    });

    it("fails, not skips, when the base branch cannot be seen", async () => {
      expect(await run(["phone-first", "--measured", "phone-first/measured", "--base", "origin/nowhere"], io())).toBe(1);
      expect(err.join("\n")).toMatch(/cannot see origin\/nowhere.*git fetch/);
    });

    it("passes the pull request that brings the baseline in", async () => {
      git("checkout", "-q", "-b", "first");
      git("rm", "-q", "phone-first.baseline.json");
      git("commit", "-q", "-m", "no baseline on this branch");
      git("checkout", "-q", "-b", "pr");
      baseline([entry('<p> "a"')]);
      expect(await run(["phone-first", "--measured", "phone-first/measured", "--base", "first"], io())).toBe(0);
      expect(out.join("\n")).toMatch(/no phone-first\.baseline\.json on first yet/);
    });

    it("does not need git when every entry is a named exception", async () => {
      baseline([entry('<p> "a"', { reason: "third-party" })]);
      expect(await run(["phone-first", "--measured", "phone-first/measured", "--base", "origin/nowhere"], io())).toBe(0);
    });
  });

  describe("every route is measured", () => {
    it("fails a page the measured routes miss, naming it", async () => {
      write("app/portal/billing/page.tsx", "<main />");
      write(`phone-first/measured/${routeFile("/")}`, JSON.stringify({ route: "/", findings: [] }));
      expect(await run(["phone-first", "--measured", "phone-first/measured"], io())).toBe(1);
      expect(err.join("\n")).toMatch(/Page routes the gate never measures.*\n\s+\/portal\/billing/);
    });

    it("passes once it is measured with a concrete id, or excluded with a reason", async () => {
      write("app/portal/[id]/page.tsx", "<main />");
      write("app/redirect/page.tsx", "<main />");
      write(`phone-first/measured/${routeFile("/")}`, JSON.stringify({ route: "/", findings: [] }));
      write(`phone-first/measured/${routeFile("/portal/p1")}`, JSON.stringify({ route: "/portal/p1?theme=dark", findings: [] }));
      expect(await run(["phone-first", "--measured", "phone-first/measured"], io())).toBe(1);
      write("phone-first.json", JSON.stringify({ source: ["app"], ignore: ["app/emails/**"], excludeRoutes: [{ route: "/redirect", reason: "redirects to /portal" }] }));
      expect(await run(["phone-first", "--measured", "phone-first/measured"], io())).toBe(0);
      expect(out.at(-1)).toMatch(/3 page routes covered/);
    });

    it("fails an excludeRoutes entry with no reason", async () => {
      write("phone-first.json", JSON.stringify({ source: ["app"], excludeRoutes: [{ route: "/" }] }));
      write(`phone-first/measured/${routeFile("/")}`, JSON.stringify({ route: "/", findings: [] }));
      expect(await run(["phone-first", "--measured", "phone-first/measured"], io())).toBe(1);
      expect(err.join("\n")).toMatch(/excludeRoutes\[0\] \(\/\): no reason/);
    });

    it("reads a built app's routes manifest as well", async () => {
      write(".next/app-path-routes-manifest.json", JSON.stringify({ "/extra/page": "/extra" }));
      write("phone-first.json", JSON.stringify({ source: ["app"], routesManifest: ".next/app-path-routes-manifest.json" }));
      write(`phone-first/measured/${routeFile("/")}`, JSON.stringify({ route: "/", findings: [] }));
      expect(await run(["phone-first", "--measured", "phone-first/measured"], io())).toBe(1);
      expect(err.join("\n")).toMatch(/\/extra/);
    });

    it("says so when it finds no app folder, instead of passing silently", async () => {
      rmSync(join(dir, "app/page.tsx"));
      write("app/components/x.tsx", "<i />");
      write("phone-first.json", JSON.stringify({ source: ["app/components"] }));
      write(`phone-first/measured/${routeFile("/")}`, JSON.stringify({ route: "/", findings: [] }));
      expect(await run(["phone-first", "--measured", "phone-first/measured"], io())).toBe(0);
      expect(out.join("\n")).toMatch(/route coverage not checked: no Next app folder/);
    });
  });

  describe("Tailwind 3 var() opacity", () => {
    it("fails on a Tailwind 3 app and passes on Tailwind 4", async () => {
      write("app/Bar.tsx", `<header className="bg-[var(--bg-1)]/95" />`);
      write("node_modules/tailwindcss/package.json", JSON.stringify({ name: "tailwindcss", version: "3.4.17" }));
      expect(await run(["phone-first"], io())).toBe(1);
      expect(err.join("\n")).toMatch(/app\/Bar\.tsx:\n {4}line 1: bg-\[var\(--bg-1\)\]\/95 \(Tailwind 3 emits no CSS/);
      write("node_modules/tailwindcss/package.json", JSON.stringify({ name: "tailwindcss", version: "4.1.18" }));
      expect(await run(["phone-first"], io())).toBe(0);
    });

    it("reads the declared version when it is not installed, and honours the override", async () => {
      write("app/Bar.tsx", `<header className="bg-[var(--bg-1)]/95" />`);
      write("package.json", JSON.stringify({ devDependencies: { tailwindcss: "^3.4.0" } }));
      expect(await run(["phone-first"], io())).toBe(1);
      write("phone-first.json", JSON.stringify({ source: ["app"], ignore: ["app/emails/**"], tailwind: 4 }));
      expect(await run(["phone-first"], io())).toBe(0);
    });
  });
});

describe("routeFile", () => {
  it("names a route's file", () => {
    expect(routeFile("/")).toBe("home.json");
    expect(routeFile("/portal/invoices")).toBe("portal-invoices.json");
    expect(routeFile("/qa/portal-snapshots/[scenario]?x=1")).toBe("qa-portal-snapshots-scenario-x-1.json");
  });
});

/**
 * The in-page half in a real Chromium at PHONE. Skipped, visibly, where no
 * browser exists; the Browser workflow requires these by name.
 */
const chromium = process.env.CRAFT_CHROMIUM ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);

describe.skipIf(!chromium)("craft phone-first in a real browser", () => {
  const PAGE = `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0;font:16px/1.5 sans-serif} .ok{display:inline-block;min-width:44px;min-height:44px} input{font-size:14px} .wide{width:500px} h1{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:200px}</style>
<h1>A page title far too long for the phone it is shown on</h1>
<main><p>Read the <a href="/terms">terms</a> before you pay.</p>
<a class="ok" href="/a">Pay</a> <a href="/b" style="font-size:16px">Invoice 1042</a>
<label for="q" style="display:block;min-height:44px">Search</label><input id="q" style="min-height:44px">
<small style="font-size:10px">VAT included</small><span class="sr-only" style="position:absolute;width:1px;height:1px;overflow:hidden;font-size:8px">skip</span>
<a href="#main" style="position:absolute;top:-60px;left:0;font-size:10px">Skip to main content</a>
<nav style="position:fixed;top:0;left:0;transform:translateX(-100%);font-size:10px"><a href="/x">Drawer link</a></nav>
<div class="wide">table</div></main>`;

  it("measures scroll, targets, fields, text and a cut-off title, and writes the route", async () => {
    const { chromium: browserType } = await import("playwright");
    const browser = await browserType.launch({ executablePath: chromium });
    const outDir = mkdtempSync(join(tmpdir(), "craft-phone-measured-"));
    try {
      const context = await browser.newContext(PHONE);
      const page = await context.newPage();
      await page.setContent(PAGE);
      const result = await measurePhone(page, { route: "/fixture", out: outDir });
      const got = result.findings.map((f) => `${f.check} ${f.element}`);
      expect(got).toContain("scroll <html>");
      expect(got).toContain(`target <a> "Invoice 1042"`);
      expect(got).toContain("field <input>");
      expect(got).toContain(`text <small> "VAT included"`);
      expect(got.some((g) => g.startsWith("title <h1>"))).toBe(true);
      // The sentence link, the 44px link, the labelled field's target and the visually hidden text all pass.
      expect(got.filter((g) => g.includes(`"terms"`) || g.includes(`"Pay"`) || g.includes("skip"))).toEqual([]);
      // Parked off the page until needed: a skip link before focus, a closed drawer.
      expect(got.filter((g) => g.includes("Skip to main content") || g.includes("Drawer link"))).toEqual([]);
      expect(got.filter((g) => g.startsWith("target <input>"))).toEqual([]);
      expect(result.viewport).toEqual({ width: 375, height: 812 });
      expect(JSON.parse(readFileSync(join(outDir, "fixture.json"), "utf8")).route).toBe("/fixture");
    } finally {
      await browser.close();
      rmSync(outDir, { recursive: true, force: true });
    }
  });
  it("holds a text field to 48px: 44px passes the target floor and still fails the field floor", async () => {
    const { chromium: browserType } = await import("playwright");
    const browser = await browserType.launch({ executablePath: chromium });
    const outDir = mkdtempSync(join(tmpdir(), "craft-phone-measured-"));
    try {
      const page = await (await browser.newContext(PHONE)).newPage();
      await page.setContent(`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0;font:16px/1.5 sans-serif} input,select,textarea{font-size:16px;display:block;box-sizing:border-box}</style>
<main><input aria-label="Small" style="height:44px"><input aria-label="Big" style="height:48px"><select aria-label="Pick" style="height:46px"><option>a</option></select>
<input type="checkbox" aria-label="Tick" style="width:20px;height:20px"></main>`);
      const result = await measurePhone(page, { route: "/fields", out: outDir });
      const fields = result.findings.filter((f) => f.check === "field").map((f) => `${f.element}: ${f.detail}`);
      expect(fields).toEqual(['<input> "Small": 44px tall, under 48px (use min-h-12)', '<select> "a": 46px tall, under 48px (use min-h-12)']);
      expect(result.findings.filter((f) => f.check === "target" && f.element.includes("Small"))).toEqual([]);
      // The floor is configurable: 44 is the old gate.
      const old = await measurePhone(page, { route: "/fields", out: outDir, floors: { fieldHeightPx: 44 } });
      expect(old.findings.filter((f) => f.check === "field")).toEqual([]);
    } finally {
      await browser.close();
      rmSync(outDir, { recursive: true, force: true });
    }
  });
});
