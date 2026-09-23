# @domandigital/sanity-copy

The Doman Digital house copy check inside Sanity Studio. Every document type
gains craft's copy rules as validation **warnings**, on the exact field that
caused them, including inside Portable Text. Publishing always still works:
copy the owner types is advised on, never overridden.

The rules are `COPY.md` in [`@domandigital/craft`](../craft). This package
only decides which strings in a document are copy, and where each finding
belongs.

## In a Studio

Works in any Sanity Studio, v3 or later. Nothing in it is specific to one
site. Two steps:

1. `pnpm add @domandigital/sanity-copy` (or npm, or yarn) in the Studio's app.
2. Wrap the types array in `sanity.config.ts`, as below.

```ts
import { defineConfig } from "sanity";
import { withCopyCheck } from "@domandigital/sanity-copy";
import { schemaTypes } from "./schemas";

export default defineConfig({
  // ...
  schema: { types: withCopyCheck(schemaTypes) },
});
```

An editor sees, on the field:

> House rule (Em dash): "local businesses — built". Use a full stop, a comma,
> or a colon.

Why a wrapper and not a plugin: a plugin's `schema.types` function runs before
the Studio's own types are added, so a plugin never sees them.

Options, all optional:

| Option | Default | What it does |
| --- | --- | --- |
| `excludeTypes` | `testimonial`, `review`, `proofQuote`, `quote` | Never checked. A person's own words are exempt from every house rule. |
| `skipFields` | `slug`, `url`, `href`, `link`, `email`, `phone`, ids, enums | Never read, at any depth. |
| `review` | `true` | Show the review and density tiers as well as the house rules. |

What is read: strings, Portable Text (a block's spans joined, so a template
split across spans is still caught), and the alt text and caption of images.
What is not: slugs, links, references, enum values, asset data.

## Sweeping a whole dataset

```bash
npx @domandigital/sanity-copy --project <id>                 # a public dataset
SANITY_API_TOKEN=... npx @domandigital/sanity-copy --project <id> --types homepage,service
npx @domandigital/sanity-copy --file export.json --json
```

Findings are listed per document and field. Exit **0** no house-rule finding,
**1** at least one, **2** nothing was checked. A token is read from the
environment, never a flag. It reports and changes nothing.

## In code

```ts
import { checkDocumentCopy, pathToString, describeFinding } from "@domandigital/sanity-copy";

for (const f of checkDocumentCopy(doc)) console.log(pathToString(f.path), describeFinding(f));
```

No Sanity dependency, and nothing a Studio imports touches Node, so the same
check runs in the Studio, a script and a test.

## Licence

Apache-2.0.
