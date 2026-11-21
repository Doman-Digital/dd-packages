# @domandigital/room-3d

Walk mode and a "Download for an AI" pack for three.js room models. Written once and shared by the
room models Doman Digital builds (each a private, no-build page behind Cloudflare Access), so they all
move and export the same way.

Plain ES modules, no build step. `three` is imported as a bare specifier, so the page's import map
supplies its own copy (one three.js instance per page).

| Module | What it does |
|---|---|
| `src/walk.js` | `createNav()`: eye-height walking (drag to look, pinch or wheel to step, tap to walk there, W A S D and arrow keys, an on-screen pad with `PAD_HTML`), and the same keys and pad spinning, tilting and sliding an OrbitControls view when not walking. |
| `src/colliders.js` | What stops you: axis-aligned rectangles (hand-built walls) or segments sliced from scanned wall meshes at a low and a waist height, so doorways stay open and window walls stay shut. Pure maths. |
| `src/agent-pack.js` | `buildAgentPack()`: one zip with the page's walk-through (`<name>.md`), its data files, labelled PNG views rendered from the live scene (to-scale plans with a 1 m bar, eye-height room views) and a GLB. `renderView()`, `exportGlb()`, `download()`, `md` table helpers. |
| `src/zip.js` | A stored (uncompressed) zip writer with CRC-32, no dependencies. |

## Using it from a no-build page

Until the package is on npm, pages load it from jsDelivr at a **pinned commit of this repo's main**
(never a branch), next to three in the import map:

```html
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/",
  "@domandigital/room-3d/": "https://cdn.jsdelivr.net/gh/Doman-Digital/dd-packages@<main-sha>/packages/room-3d/src/"
} }
</script>
```

```js
import { createNav, walkHint } from '@domandigital/room-3d/walk.js';
const nav = createNav({ camera, controls, canvas: renderer.domElement, colliders, pad, hit, onMode });
// each frame: if (!nav.update(dt)) controls.update();
const { buildAgentPack, download } = await import('@domandigital/room-3d/agent-pack.js');
```

To change the shared code: change it here, merge, then move each page's import map to the new main
commit and run that page's own walk and view checks.

It is `private` (not published) for now: a first npm publish is done by hand with the npm owner's
two-step code (see `docs/releasing.md`). The jsDelivr commit pin is immutable, so the pages cannot
drift from the commit they name.

## Tests

```bash
pnpm --filter @domandigital/room-3d test
```

Colliders (hand-built rectangles, diagonal segments, a sliced wall with a doorway
and a window) and the zip (CRC-32 check value, a reader walking the central directory).
