---
"@domandigital/craft": minor
---

Phase M: imagery and provenance.

- Snapshots record every picture on the page as `images`: each `img` and each CSS background large enough to be one, with its source (unwrapped from `/_next/image?url=`, `/_vercel/image` and Cloudflare's `/cdn-cgi/image/`), size, position, section, alt text and a role (`photo`, `illustration`, `icon`, `avatar`, `logo`). At most 60, largest first. Older snapshots have no `images` and are never judged on them.
- `craft audit` reads the first 256 KB of up to 24 of the larger pictures (20 seconds at most per page) and records `provenance`: the IPTC digital source type when an XMP packet or a C2PA manifest says a trained model made the picture. Only a positive is evidence; a picture with no marker is unknown. `snapshotUrl(url, { provenance: false })` skips the reads.
- Four rendered tells, all `warn`: `stock-photo` (a stock library or placeholder service, by host or by the library's own file name), `stock-avatar` (placeholder-face services), `ai-image` (the picture's own metadata says a model made it) and `no-real-imagery` (a page of four or more sections with no photograph). `CATALOGUE_VERSION` is `2026.09.11`.
- New exports: `IMAGERY_TELLS`, `STOCK_PHOTO_HOSTS`, `STOCK_AVATAR_HOSTS`, `stockSource`, `stockAvatarSource`, `scanProvenance`, `PROVENANCE_SCAN_BYTES`, `AI_SOURCE_TYPES`, and the types `SnapshotImage`, `ImageRole`, `ImageProvenance`. From `@domandigital/craft/audit`: `PROVENANCE_MAX_IMAGES`, `PROVENANCE_BUDGET_MS`.
