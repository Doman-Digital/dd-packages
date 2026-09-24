---
"@domandigital/craft": minor
"@domandigital/gbp": minor
"@domandigital/graph": minor
"@domandigital/seo": minor
"@domandigital/sanity-copy": minor
---

CommonJS consumers now get the CommonJS type declarations. The `exports` map put a top-level `types` (the ESM `.d.ts`) ahead of `require`, so TypeScript resolving a `require` under `node16` stopped at the ESM file ("Masquerading as ESM" in @arethetypeswrong/cli). `types` now sits inside `import` and `require` separately. Runtime behaviour is unchanged.

Requires Node 22.12 or later (`engines.node`). Node 20 reached end of life on 2026-04-30. Also declares `sideEffects` so bundlers can tree-shake (craft keeps its CSS).
