# @domandigital/sanity-copy

The Doman Digital house copy check inside Sanity Studio. Every document type
gains craft's copy rules as validation **warnings**, on the exact field that
caused them, including inside Portable Text. Publishing always still works:
copy the owner types is advised on, never overridden.

The rules are `COPY.md` in [`@domandigital/craft`](../craft). This package
only decides which strings in a document are copy, and where each finding
belongs.

## In a Studio

Works in any Sanity Studio, v3 or later. It uses only `Rule.custom()`,
`Rule.warning()` and plain document-action functions, and imports nothing from
Sanity, so no Studio version is pinned. Its tests run against stand-ins for
those shapes, not a live Studio. Nothing in it is specific to one site. Two
steps:

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
| `excludeTypes` | `testimonial`, `review`, `proofQuote`, `quote`, `assist.instruction.context` | Never checked. A person's own words are exempt from every house rule, and AI Assist instruction documents are prompts, not copy. |
| `skipFields` | `slug`, `url`, `href`, `link`, `email`, `phone`, `language`, `locale`, ids, enums | Never read, at any depth. |
| `review` | `true` | Show the review and density tiers as well as the house rules. |
| `languages` | every language | Check only these, e.g. `["en"]`. See below. |
| `hiddenPaths` | from the schema | Dot paths never read. `withCopyCheck` fills this in from every static `hidden: true`. |

What is read: strings, Portable Text (a block's spans joined, so a template
split across spans is still caught), and the alt text and caption of images.
What is not: slugs, links, references, enum values, language tags, asset data,
and fields the schema hides with `hidden: true`. A `hidden` function is not
evaluated: it is decided per document and per editor, and the check has no way
to know the answer for a nested field, so those fields are still read.

### Localised content

The rules are English. On a localised Studio, pass `languages: ["en"]` so the
other languages are left alone (`"en"` also covers `en-GB` and `en_US`). Four
shapes are recognised:

| Shape | Example | How the language is found |
| --- | --- | --- |
| sanity-plugin-internationalized-array v5 | `[{ _key: "k8f2a", language: "fr", value }]` | the item's `language` field |
| the same plugin, v4 and earlier | `[{ _key: "fr", value }]` | the item's `_key` |
| field-level translation | `{ en: "...", fr: "..." }` | the object key, when every key is a two-letter language tag |
| @sanity/document-internationalization | `{ _type: "page", language: "fr" }` | the document's `language` field |

### Blocking publish (opt-in)

Everything above warns. A Studio that wants the house rules enforced can wrap
the publish action, which then stays disabled while the document has a
blocking-tier finding, with the finding as its tooltip. The review tier never
blocks.

```ts
import { withCopyCheck, withCopyGuard } from "@domandigital/sanity-copy";

export default defineConfig({
  schema: { types: withCopyCheck(schemaTypes) },
  document: {
    actions: (prev) => prev.map((a) => (a.action === "publish" ? withCopyGuard(a) : a)),
  },
});
```

The original action is always called, so its behaviour is unchanged apart from
`disabled` and the tooltip. Excluded types (testimonials and the rest) are never
blocked.

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
