---
"@domandigital/create-site": minor
---

Generated sites now check dynamic routes. The route enumerators return `dynamicRoutesOnDisk()` alongside `routesOnDisk()`, the seeded `site.routes.ts` gets a `/prefix/*` policy entry for each dynamic route (Next.js `app/blog/[slug]`, Astro `src/pages/blog/[slug].astro`), and the generated coverage test passes them to seo's `validateCoverage`, so a new dynamic route with no policy fails `seo:check` instead of passing silently.
