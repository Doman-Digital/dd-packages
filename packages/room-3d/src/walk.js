// Walk mode and the shared inputs for a three.js room model.
// Walking: the camera stands at eye height and looks along yaw (0 = towards -z) and pitch, with
// OrbitControls off. Drag looks round, a pinch or the wheel steps forward, a tap walks to the point
// tapped, W A S D and the arrow keys move and turn, and an on-screen pad does the same by touch.
// Looking round a point (OrbitControls on), the same keys and pad spin, tilt, slide and zoom.
// `three` is imported as a bare specifier, so the page's import map supplies its own copy.
import * as THREE from 'three';
import { collide as collideWith } from './colliders.js';

export const KEYS = {
  KeyW: 'fwd:1', ArrowUp: 'fwd:1', KeyS: 'fwd:-1', ArrowDown: 'fwd:-1', KeyA: 'strafe:-1', KeyD: 'strafe:1',
  ArrowLeft: 'turn:1', KeyQ: 'turn:1', ArrowRight: 'turn:-1', KeyE: 'turn:-1', KeyR: 'tilt:1', KeyF: 'tilt:-1',
  Equal: 'zoom:1', NumpadAdd: 'zoom:1', Minus: 'zoom:-1', NumpadSubtract: 'zoom:-1',
};

export const PAD_LABELS = {
  walk: { 'fwd:1': 'Walk forward', 'fwd:-1': 'Walk back', 'strafe:-1': 'Step left', 'strafe:1': 'Step right', 'turn:1': 'Turn left', 'turn:-1': 'Turn right', 'zoom:1': 'Zoom in', 'zoom:-1': 'Zoom out' },
  orbit: { 'fwd:1': 'Look from higher', 'fwd:-1': 'Look from lower', 'strafe:-1': 'Slide left', 'strafe:1': 'Slide right', 'turn:1': 'Spin left', 'turn:-1': 'Spin right', 'zoom:1': 'Move closer', 'zoom:-1': 'Move away' },
};

// The pad's eight buttons, four across and two down. A page puts them in its own container
// (role="group") and styles them; createNav finds them by data-in and keeps their labels right.
const ARROW = (deg) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5l-7 8h4.5v6h5v-6H19z" transform="rotate(${deg} 12 12)"/></svg>`;
const TURN = (flip) => `<svg viewBox="0 0 24 24" aria-hidden="true"${flip ? ' class="flip"' : ''}><path d="M12 5a7 7 0 1 1-6.6 4.7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M2.6 6.2l2.9 3.9 4-2.6z"/></svg>`;
export const PAD_HTML = [
  `<button data-in="turn:1" aria-label="Turn left">${TURN(true)}</button>`,
  `<button data-in="fwd:1" aria-label="Walk forward">${ARROW(0)}</button>`,
  `<button data-in="turn:-1" aria-label="Turn right">${TURN(false)}</button>`,
  '<button data-in="zoom:1" aria-label="Zoom in" class="pad-zoom">+</button>',
  `<button data-in="strafe:-1" aria-label="Step left">${ARROW(-90)}</button>`,
  `<button data-in="fwd:-1" aria-label="Walk back">${ARROW(180)}</button>`,
  `<button data-in="strafe:1" aria-label="Step right">${ARROW(90)}</button>`,
  '<button data-in="zoom:-1" aria-label="Zoom out" class="pad-zoom">−</button>',
].join('\n');

export const walkHint = (coarse) => (coarse
  ? 'Drag to look · use the arrows to walk · tap the floor to walk there'
  : 'Drag to look · W A S D or the arrow keys to walk · click the floor to walk there');

/**
 * @param {object} o
 * @param {THREE.PerspectiveCamera} o.camera
 * @param {HTMLElement} o.canvas            the renderer's canvas (pointer and wheel input)
 * @param {object} [o.controls]            OrbitControls, switched off while walking
 * @param {Array} o.colliders               rectangles and segments (see colliders.js); kept by reference
 * @param {object} [o.settings]             live { speed, eye } (eye 0 = the walk's own height)
 * @param {number} [o.body]                 body radius in metres
 * @param {object} [o.bounds]               { minX, maxX, minZ, maxZ }
 * @param {(ev: PointerEvent) => ({ point: THREE.Vector3 } | null | undefined)} o.hit  what a tap lands on
 * @param {(ev: PointerEvent, walking: boolean) => boolean} [o.onTap]   return true when the page handled the tap
 * @param {(ev: PointerEvent) => void} [o.onDoubleTap]                  looking round a point only
 * @param {() => boolean} [o.paused]        true to ignore pointer input (a panel or a drag owns it)
 * @param {(e: KeyboardEvent) => boolean} [o.keysAllowed]
 * @param {() => void} [o.onHome]           the H key
 * @param {HTMLElement} [o.pad]             element holding buttons with data-in="fwd:1" and so on
 * @param {(walking: boolean) => void} [o.onMode]     after entering or leaving walk mode
 * @param {() => void} [o.onZoom]           after the walk zoom changes (the page sets the field of view)
 * @param {() => boolean} [o.busy]          true while the page is flying the camera (no orbit nudges)
 */
export function createNav(o) {
  const { camera, canvas, controls = null } = o;
  const settings = o.settings || { speed: 1, eye: 0 };
  const body = o.body ?? 0.18;
  const walk = { on: false, x: 0, y: 1.6, z: 0, yaw: 0, pitch: 0, goal: null };
  const held = new Map(); // input key (e.g. "fwd:1") -> source count
  const nav = { walk, held, zoom: 1, colliders: o.colliders, body };

  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  nav.placeCamera = () => {
    camera.position.set(walk.x, settings.eye || walk.y, walk.z);
    camera.quaternion.setFromEuler(euler.set(walk.pitch, walk.yaw, 0, 'YXZ'));
  };
  nav.collide = (x, z) => collideWith(nav.colliders, x, z, body, o.bounds);
  // Move by (dx, dz) in small steps so a fast step cannot pass through a 10 cm wall. Returns how far it got.
  nav.walkBy = (dx, dz) => {
    const dist = Math.hypot(dx, dz), steps = Math.max(1, Math.ceil(dist / 0.04));
    const x0 = walk.x, z0 = walk.z;
    for (let i = 0; i < steps; i++) [walk.x, walk.z] = nav.collide(walk.x + dx / steps, walk.z + dz / steps);
    return Math.hypot(walk.x - x0, walk.z - z0);
  };
  nav.syncPad = () => {
    if (!o.pad) return;
    const names = PAD_LABELS[walk.on ? 'walk' : 'orbit'];
    o.pad.querySelectorAll('[data-in]').forEach((b) => { b.setAttribute('aria-label', names[b.dataset.in]); b.title = names[b.dataset.in]; });
  };
  /** Start walking from where the camera is, looking where it looks (or from `at`: { x, y, z, yaw, pitch }). */
  nav.enter = (at) => {
    const d = camera.getWorldDirection(new THREE.Vector3());
    Object.assign(walk, { on: true, x: camera.position.x, y: camera.position.y, z: camera.position.z, yaw: Math.atan2(-d.x, -d.z), pitch: Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)), goal: null }, at || {});
    if (at) [walk.x, walk.z] = nav.collide(walk.x, walk.z);
    if (controls) controls.enabled = false;
    nav.placeCamera(); nav.syncPad(); o.onMode?.(true);
  };
  nav.leave = () => {
    if (!walk.on) return;
    walk.on = false; walk.goal = null;
    if (controls) {
      controls.enabled = true;
      // Hand OrbitControls a target a metre ahead, so orbiting (or the next flight) starts from where you are looking.
      controls.target.copy(camera.position).addScaledVector(camera.getWorldDirection(new THREE.Vector3()), 1);
    }
    nav.syncPad(); o.onMode?.(false);
  };
  /** Turn (while walking) to face a point on the floor plan. */
  nav.face = (x, z, y) => {
    walk.yaw = Math.atan2(-(x - walk.x), -(z - walk.z));
    walk.pitch = y === undefined ? 0 : THREE.MathUtils.clamp(Math.atan2(y - (settings.eye || walk.y), Math.hypot(x - walk.x, z - walk.z)), -1.45, 1.45);
    walk.goal = null;
  };
  nav.press = (key, on) => { const n = (held.get(key) || 0) + (on ? 1 : -1); if (n > 0) held.set(key, n); else held.delete(key); };
  const press = nav.press;
  const axis = (name) => (held.has(`${name}:1`) ? 1 : 0) - (held.has(`${name}:-1`) ? 1 : 0);

  // ---------- pointer: drag to look, pinch to step, tap to walk ----------
  const touches = new Map();
  let look = null, lastTap = null;
  const paused = () => !!o.paused?.();
  canvas.addEventListener('pointerdown', (ev) => {
    if (paused()) return;
    touches.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (touches.size === 1) look = { x: ev.clientX, y: ev.clientY, t: performance.now(), moved: 0 };
    else if (look) look.moved = 99; // a second finger: a pinch, never a tap
    if (walk.on) try { canvas.setPointerCapture(ev.pointerId); } catch { /* pointer already gone */ }
  });
  canvas.addEventListener('pointermove', (ev) => {
    const p = touches.get(ev.pointerId); if (!p) return;
    const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
    if (look) look.moved += Math.abs(dx) + Math.abs(dy);
    if (walk.on && !paused()) {
      if (touches.size === 1) {
        // Grab the view: dragging right swings it left, as if pulling the room round.
        const k = 0.0042 / Math.max(0.4, nav.zoom) * (camera.fov / 60);
        walk.yaw += dx * k; walk.pitch = THREE.MathUtils.clamp(walk.pitch + dy * k, -1.45, 1.45); walk.goal = null;
      } else if (touches.size === 2) {
        const [a, b] = [...touches.entries()].map(([id, q]) => (id === ev.pointerId ? { x: ev.clientX, y: ev.clientY } : q));
        const [a0, b0] = [...touches.values()];
        const spread = Math.hypot(a.x - b.x, a.y - b.y) - Math.hypot(a0.x - b0.x, a0.y - b0.y);
        nav.walkBy(-Math.sin(walk.yaw) * spread * 0.006, -Math.cos(walk.yaw) * spread * 0.006);
      }
    }
    p.x = ev.clientX; p.y = ev.clientY;
  });
  function endTouch(ev) {
    if (!touches.has(ev.pointerId)) return;
    touches.delete(ev.pointerId);
    const tap = look && look.moved < 8 && performance.now() - look.t < 450;
    if (touches.size === 0) look = null;
    if (!tap || ev.type !== 'pointerup') return;
    if (o.onTap?.(ev, walk.on)) return;
    if (walk.on) {
      // Tap or click somewhere: walk towards it (walls stop you).
      const h = o.hit(ev); if (h) walk.goal = { x: h.point.x, z: h.point.z };
      return;
    }
    const now = performance.now();
    if (lastTap && now - lastTap.t < 350 && Math.hypot(ev.clientX - lastTap.x, ev.clientY - lastTap.y) < 24) {
      o.onDoubleTap?.(ev); lastTap = null;
    } else lastTap = { t: now, x: ev.clientX, y: ev.clientY };
  }
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => canvas.addEventListener(t, endTouch));
  canvas.addEventListener('wheel', (ev) => {
    if (!walk.on) return; // OrbitControls zooms when looking round a point
    ev.preventDefault(); walk.goal = null;
    const d = -ev.deltaY * 0.0025 * settings.speed;
    nav.walkBy(-Math.sin(walk.yaw) * d, -Math.cos(walk.yaw) * d);
  }, { passive: false });

  // ---------- keyboard (ignored while typing and whenever the page says so) ----------
  const keysDown = new Set();
  const keysAllowed = (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return false;
    if (e.target.closest?.('input, textarea, select, [contenteditable]')) return false;
    return o.keysAllowed ? o.keysAllowed(e) : true;
  };
  document.addEventListener('keydown', (e) => {
    if (!keysAllowed(e)) return;
    if (e.code === 'KeyH' && !e.repeat && o.onHome) { o.onHome(); return; }
    const k = KEYS[e.code]; if (!k) return;
    e.preventDefault(); if (keysDown.has(e.code)) return;
    keysDown.add(e.code); press(k, true); walk.goal = null;
  });
  document.addEventListener('keyup', (e) => { const k = KEYS[e.code]; if (k && keysDown.delete(e.code)) press(k, false); });
  window.addEventListener('blur', () => { keysDown.clear(); held.clear(); });

  // ---------- on-screen pad: hold a button to keep moving; a keyboard press on a focused button nudges once ----------
  if (o.pad && !o.pad.querySelector('[data-in]')) o.pad.innerHTML = PAD_HTML;
  o.pad?.querySelectorAll('[data-in]').forEach((b) => {
    const k = b.dataset.in; let down = false;
    b.addEventListener('pointerdown', (ev) => { ev.preventDefault(); try { b.setPointerCapture(ev.pointerId); } catch { /* pointer already gone */ } if (!down) { down = true; press(k, true); walk.goal = null; } });
    const up = () => { if (down) { down = false; press(k, false); } };
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => b.addEventListener(t, up));
    b.addEventListener('click', (ev) => { if (ev.detail === 0) { press(k, true); setTimeout(() => press(k, false), 250); } });
    b.addEventListener('contextmenu', (ev) => ev.preventDefault());
  });

  // ---------- each frame ----------
  const spherical = new THREE.Spherical(), offset = new THREE.Vector3(), side = new THREE.Vector3();
  /** Move for this frame. Returns true while walking (the page then skips controls.update()). */
  nav.update = (dt) => {
    const fwd = axis('fwd'), strafe = axis('strafe'), turn = axis('turn'), tilt = axis('tilt'), zoom = axis('zoom');
    const sp = settings.speed;
    if (walk.on) {
      walk.yaw += turn * 1.5 * sp * dt;
      walk.pitch = THREE.MathUtils.clamp(walk.pitch + tilt * 1.1 * sp * dt, -1.45, 1.45);
      if (zoom) { nav.zoom = THREE.MathUtils.clamp(nav.zoom * Math.exp(zoom * 1.2 * dt), 0.5, 1.6); o.onZoom?.(); }
      let dx = 0, dz = 0;
      if (fwd || strafe) {
        const s = 1.1 * sp * dt, sy = Math.sin(walk.yaw), cy = Math.cos(walk.yaw);
        dx = (-sy * fwd + cy * strafe) * s; dz = (-cy * fwd - sy * strafe) * s;
      } else if (walk.goal) {
        const gx = walk.goal.x - walk.x, gz = walk.goal.z - walk.z, d = Math.hypot(gx, gz), s = Math.min(d, 1.3 * sp * dt);
        if (d < 0.3 + body) walk.goal = null; else { dx = (gx / d) * s; dz = (gz / d) * s; }
      }
      if (dx || dz) { const got = nav.walkBy(dx, dz); if (walk.goal && got < 0.002) walk.goal = null; }
      nav.placeCamera();
      return true;
    }
    if (!controls || o.busy?.() || !(fwd || strafe || turn || tilt || zoom)) return false;
    offset.subVectors(camera.position, controls.target); spherical.setFromVector3(offset);
    spherical.theta -= turn * 1.2 * sp * dt;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi - (fwd + tilt) * 0.9 * sp * dt, 0.05, controls.maxPolarAngle);
    spherical.radius = THREE.MathUtils.clamp(spherical.radius * Math.exp(-zoom * 1.3 * sp * dt), controls.minDistance, controls.maxDistance);
    offset.setFromSpherical(spherical);
    if (strafe) {
      side.setFromMatrixColumn(camera.matrixWorld, 0); side.y = 0; side.normalize();
      controls.target.addScaledVector(side, strafe * 0.7 * spherical.radius * sp * dt);
    }
    camera.position.copy(controls.target).add(offset);
    return false;
  };

  nav.syncPad();
  return nav;
}
