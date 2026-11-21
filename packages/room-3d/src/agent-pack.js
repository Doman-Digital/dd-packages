// The agent pack: one zip that lets Claude or another agent see a room model properly.
//   <name>.md      plain-English walk-through, read first (written by the page: it knows its own data)
//   data files     the page's own JSON, as it is
//   views/*.png    labelled stills rendered from the live scene (agents read images well, GLB poorly)
//   <name>.glb     the live scene for 3D tools and Blender
// Built in the browser from the running page, so it carries what this device has (ticks, a layout).
// Scripts on a machine get the same zip by driving the page headless and calling the same function.
import * as THREE from 'three';
import { zip } from './zip.js';

/**
 * A view to render.
 * @typedef {object} View
 * @property {string} file                 e.g. "plan.png" (goes in views/)
 * @property {string} title                printed at the top of the image
 * @property {number[]} pos                camera position [x, y, z]
 * @property {number[]} target             what it looks at
 * @property {number} [fov]                perspective field of view (degrees)
 * @property {number[]} [ortho]            [width, height] in metres: a scaled, straight-down plan instead
 * @property {number[]} [up]               camera up (default [0, 1, 0]; a plan wants [0, 0, -1])
 * @property {{ text: string, at: number[], colour?: string, owner?: THREE.Object3D }[]} [labels]
 * @property {boolean} [occlude]           leave out a label whose point is hidden behind something that is not its owner
 * @property {() => (() => void) | void} [before]  set the scene up for this view; return a function that undoes it
 * @property {{ width: number, height: number }} [size]  this view's pixel size (default: the pack's)
 */

const ink = '#111418', paper = 'rgba(255,255,255,0.88)';

// Draw a label as a pill centred on (x, y), moved down past any pill already drawn, so none overlap.
function pill(g, text, x, y, size, colour, taken) {
  g.font = `600 ${size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  const w = g.measureText(text).width + size * 0.8, h = size * 1.45;
  const hits = (yy) => taken.some((r) => Math.abs(r.x - x) < (r.w + w) / 2 + 2 && Math.abs(r.y - yy) < h + 2);
  for (let i = 0; i < 8 && hits(y); i++) y += h + 3;
  taken.push({ x, y, w });
  g.fillStyle = paper; g.strokeStyle = colour || 'rgba(0,0,0,0.35)'; g.lineWidth = Math.max(1, size / 9);
  g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, h / 2); g.fill(); g.stroke();
  g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, x, y + size * 0.04);
}

/** Render one view of the scene to PNG bytes, at a fixed size, leaving the renderer as it was. */
export async function renderView(renderer, scene, view, { width = 1280, height = 960 } = {}) {
  const aspect = width / height;
  let cam;
  if (view.ortho) {
    let [w, h] = view.ortho; if (w / h > aspect) h = w / aspect; else w = h * aspect;
    cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.05, 100);
  } else cam = new THREE.PerspectiveCamera(view.fov || 55, aspect, 0.03, 100);
  if (view.up) cam.up.set(...view.up);
  cam.position.set(...view.pos); cam.lookAt(...view.target); cam.updateMatrixWorld();
  const out = document.createElement('canvas'); out.width = width; out.height = height;
  const g = out.getContext('2d');
  const fs = Math.round(width / 58);
  const ray = new THREE.Raycaster(), p = new THREE.Vector3(), dir = new THREE.Vector3();
  // Hidden: something opaque that is not the label's owner sits between the camera and the label's point.
  const hidden = (l) => {
    p.set(...l.at); dir.subVectors(p, cam.position); const dist = dir.length(); dir.normalize();
    ray.set(cam.position, dir); ray.far = dist; ray.camera = cam; // sprites need the camera
    const hit = ray.intersectObjects(scene.children, true).find((h) => {
      for (let o = h.object; o; o = o.parent) if (!o.visible) return false;
      return h.object.isMesh && !(h.object.material?.transparent && h.object.material.opacity < 0.6);
    });
    if (!hit || hit.distance > dist - 0.12) return false;
    for (let o = hit.object; o; o = o.parent) if (o === l.owner) return false;
    return true;
  };

  const undo = view.before?.();
  const size = renderer.getSize(new THREE.Vector2()), ratio = renderer.getPixelRatio(), target = renderer.getRenderTarget();
  const shown = [];
  try {
    // Render and copy in the same task: the canvas still holds the frame, with no preserveDrawingBuffer.
    renderer.setRenderTarget(null); renderer.setPixelRatio(1); renderer.setSize(width, height, false);
    renderer.render(scene, cam);
    g.drawImage(renderer.domElement, 0, 0, width, height);
    const v = new THREE.Vector3();
    for (const l of view.labels || []) {
      v.set(...l.at).project(cam);
      if (v.z < -1 || v.z > 1 || Math.abs(v.x) > 1.02 || Math.abs(v.y) > 1.02) continue;
      if (view.occlude && hidden(l)) continue;
      shown.push({ l, x: (v.x + 1) / 2 * width, y: (1 - v.y) / 2 * height });
    }
  } finally {
    renderer.setPixelRatio(ratio); renderer.setSize(size.x, size.y, false); renderer.setRenderTarget(target);
    if (typeof undo === 'function') undo();
  }
  const taken = [];
  for (const { l, x, y } of shown) pill(g, l.text, x, y, fs, l.colour, taken);
  if (view.ortho) {
    // A one-metre scale bar, bottom left.
    const px = width / (cam.right - cam.left), x0 = fs * 1.5, y0 = height - fs * 1.6;
    g.fillStyle = paper; g.fillRect(x0 - 8, y0 - fs * 1.7, px + 16, fs * 2.3);
    g.fillStyle = ink; g.fillRect(x0, y0, px, Math.max(3, fs / 5));
    g.font = `600 ${fs}px system-ui, sans-serif`; g.textAlign = 'left'; g.textBaseline = 'bottom';
    g.fillText('1 m', x0, y0 - 4);
  }
  if (view.title) {
    g.fillStyle = 'rgba(17,20,24,0.82)'; g.fillRect(0, 0, width, fs * 2.2);
    g.fillStyle = '#fff'; g.font = `600 ${Math.round(fs * 1.1)}px system-ui, sans-serif`;
    g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(view.title, fs, fs * 1.1);
  }
  const blob = await new Promise((r) => out.toBlob(r, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

/** The live scene (or part of it) as binary glTF. */
export async function exportGlb(root, options = {}) {
  const { GLTFExporter } = await import('three/addons/exporters/GLTFExporter.js');
  const bytes = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true, ...options });
  return new Uint8Array(bytes);
}

/**
 * Build the zip.
 * @param {object} o
 * @param {THREE.WebGLRenderer} o.renderer
 * @param {THREE.Scene} o.scene
 * @param {{ name: string, text: string }} o.readme          the walk-through, e.g. { name: 'room.md', text }
 * @param {{ name: string, data: string | Uint8Array }[]} [o.files]   data files, as they are
 * @param {View[]} [o.views]
 * @param {{ name: string, data?: Uint8Array, root?: THREE.Object3D, make?: () => Promise<Uint8Array | ArrayBuffer> }} [o.glb]
 * @param {{ width: number, height: number }} [o.size]
 * @param {(done: number, total: number) => void} [o.progress]
 * @returns {Promise<{ bytes: Uint8Array, names: string[] }>}
 */
export async function buildAgentPack(o) {
  const files = [{ name: o.readme.name, data: o.readme.text }, ...(o.files || [])];
  const views = o.views || [];
  const total = views.length + (o.glb ? 1 : 0);
  let done = 0;
  for (const v of views) {
    files.push({ name: `views/${v.file}`, data: await renderView(o.renderer, o.scene, v, v.size || o.size) });
    o.progress?.(++done, total);
    await new Promise((r) => setTimeout(r, 0)); // let the page paint between views
  }
  if (o.glb) {
    const data = o.glb.data || (o.glb.make ? new Uint8Array(await o.glb.make()) : await exportGlb(o.glb.root || o.scene));
    files.push({ name: o.glb.name, data });
    o.progress?.(++done, total);
  }
  return { bytes: zip(files), names: files.map((f) => f.name) };
}

/** Hand the bytes to the browser as a download. */
export function download(bytes, filename) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

/** Markdown helpers the pages share when writing their walk-through. */
export const md = {
  table(head, rows) {
    const cell = (c) => String(c ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    return [`| ${head.map(cell).join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`)].join('\n');
  },
  list: (items) => items.map((i) => `- ${i}`).join('\n'),
};
