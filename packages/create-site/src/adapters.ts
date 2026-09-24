// Where each file goes in a Next.js or an Astro project, and what every
// `~site/<key>` import in the templates points at. The templates themselves
// are identical across sites; only these paths differ.

import type { Project } from "./detect.js";

export type TemplateFile = {
  /** Path under templates/. */
  template: string;
  /** Path in the site, relative to its root. */
  dest: string;
};

export type Layout = {
  templates: TemplateFile[];
  /** `~site/<key>` → path in the site, relative to its root. */
  siteKeys: Record<string, string>;
};

export function layoutFor(project: Project): Layout {
  const base = project.srcBase;
  const shared: TemplateFile[] = [
    { template: "shared/lib/graph/site-adapter.ts", dest: `${base}lib/graph/site-adapter.ts` },
    { template: "shared/lib/graph/page-graph.ts", dest: `${base}lib/graph/page-graph.ts` },
    { template: "shared/tests/seo/coverage.test.ts", dest: "tests/seo/coverage.test.ts" },
    { template: "shared/tests/seo/redirects.test.ts", dest: "tests/seo/redirects.test.ts" },
    { template: "shared/tests/seo/graph.test.ts", dest: "tests/seo/graph.test.ts" },
    { template: "shared/tests/house.test.ts", dest: "tests/house.test.ts" },
  ];
  const siteKeys: Record<string, string> = {
    facts: "site.facts.ts",
    routes: "site.routes.ts",
    "links.json": "links.json",
    "redirects.json": "redirects.json",
    "site-adapter": `${base}lib/graph/site-adapter.ts`,
    "page-graph": `${base}lib/graph/page-graph.ts`,
    "routes-on-disk": "tests/seo/routes-on-disk.ts",
  };
  if (project.configFile) siteKeys["framework-config"] = project.configFile;

  if (project.framework === "next") {
    siteKeys["components/JsonLd"] = `${base}components/JsonLd.tsx`;
    return {
      siteKeys,
      templates: [
        ...shared,
        { template: "next/tests/seo/routes-on-disk.ts", dest: "tests/seo/routes-on-disk.ts" },
        { template: "next/tests/seo/config.test.ts", dest: "tests/seo/config.test.ts" },
        { template: "next/components/JsonLd.tsx", dest: `${base}components/JsonLd.tsx` },
        { template: "next/components/DesignerCredit.tsx", dest: `${base}components/DesignerCredit.tsx` },
        { template: "next/app/press/page.tsx", dest: `${project.routesDir}/press/page.tsx` },
        { template: "next/app/resources/page.tsx", dest: `${project.routesDir}/resources/page.tsx` },
      ],
    };
  }

  siteKeys["components/JsonLd.astro"] = "src/components/JsonLd.astro";
  return {
    siteKeys,
    templates: [
      ...shared,
      { template: "astro/tests/seo/routes-on-disk.ts", dest: "tests/seo/routes-on-disk.ts" },
      { template: "astro/tests/seo/config.test.ts", dest: "tests/seo/config.test.ts" },
      { template: "astro/components/JsonLd.astro", dest: "src/components/JsonLd.astro" },
      { template: "astro/components/DesignerCredit.astro", dest: "src/components/DesignerCredit.astro" },
      { template: "astro/pages/press.astro", dest: "src/pages/press.astro" },
      { template: "astro/pages/resources/index.astro", dest: "src/pages/resources/index.astro" },
    ],
  };
}
