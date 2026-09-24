---
"@domandigital/craft": patch
"@domandigital/gbp": patch
"@domandigital/graph": patch
"@domandigital/sanity-copy": patch
"@domandigital/seo": patch
---

Fix the types a CommonJS TypeScript project gets. The exports map listed `types` before `import` and `require`, so TypeScript resolving through `require` matched the ESM declarations (`.d.ts`) and never reached the CommonJS ones (`.d.cts`). attw reported every package as "Masquerading as ESM" under node16 from CJS. Each condition now carries its own `types`. Runtime behaviour is unchanged: the same files load for `require` and `import` as before.
