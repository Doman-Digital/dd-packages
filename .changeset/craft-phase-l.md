---
"@domandigital/craft": minor
---

Phase L: component-level sameness.

- Six rendered tells, all `warn`, read from snapshot version 2: `cta-band-stock` (a centred band on its own colour with one or two buttons), `pricing-trio-popular` (three price cards, one badged "Most popular"), `testimonial-avatar-carousel`, `faq-accordion-closer` (the page ends on a question list), `stats-row` (a row of three to six big figures) and `centred-everything`. A version 1 snapshot never trips them. `CATALOGUE_VERSION` is `2026.09.10`.
- Tells can now have `surface: "rendered"`: they exist only on a rendered page, so they carry snapshot fixtures and no source fixtures. `runTell` refuses them; use `auditSnapshot`.
- Snapshot sections gain `badges`, `avatars`, `carousel` and `figures`; fingerprint sections gain `symmetry`, `controls`, `cards`, `background`, `badges`, `avatars`, `carousel` and `figures`.
- `craft estate compare --component <role>` ranks pairs of sites by how alike one component is and names what they share. `craft estate compare <site> --component <role>` compares one site against the rest. There is no sibling line for components yet, so it ranks and judges nothing.
- `craft audit --null` scores each component against the same role in the null model (`components` in the JSON).
- New exports: `RENDERED_TELLS`, `COMPONENT_ROLES`, `PROMO_BADGE`, `componentsOf`, `componentDistance`, `componentShared`, `closestComponents`, `estateComponentPairs`, `componentTypicality`, `componentTypicalities`, and the types `RenderedTell`, `ComponentPair`, `ComponentTypicality`.
