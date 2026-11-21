// Walking colliders: what stops a body of radius `body` on the floor plan (x, z).
// Two shapes:
//   { x0, x1, z0, z1 }   an axis-aligned rectangle (hand-built walls)
//   { ax, az, bx, bz }   a line segment (sliced from a scanned wall mesh, any angle)
// Pure maths, no three.js, so it runs in Node tests as it does in the page.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

function nearest(c, x, z) {
  if (c.ax !== undefined) {
    const vx = c.bx - c.ax, vz = c.bz - c.az, len2 = vx * vx + vz * vz;
    const t = len2 > 0 ? clamp(((x - c.ax) * vx + (z - c.az) * vz) / len2, 0, 1) : 0;
    return [c.ax + vx * t, c.az + vz * t];
  }
  return [clamp(x, c.x0, c.x1), clamp(z, c.z0, c.z1)];
}

/**
 * Push (x, z) out of every collider so a body of radius `body` stays clear. Two passes, so a corner
 * where two walls meet settles. `bounds` is the outer limit ({ minX, maxX, minZ, maxZ }).
 */
export function collide(colliders, x, z, body = 0.18, bounds = { minX: -9, maxX: 9, minZ: -9, maxZ: 9 }) {
  for (let pass = 0; pass < 2; pass++) {
    for (const c of colliders) {
      const [cx, cz] = nearest(c, x, z);
      const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
      if (d2 >= body * body) continue;
      if (d2 > 1e-10) { const d = Math.sqrt(d2); x = cx + (dx / d) * body; z = cz + (dz / d) * body; continue; }
      if (c.ax !== undefined) {
        // Exactly on the line: step off it along its normal.
        const vx = c.bx - c.ax, vz = c.bz - c.az, len = Math.hypot(vx, vz) || 1;
        x += (-vz / len) * body; z += (vx / len) * body;
        continue;
      }
      // Inside the rectangle itself: leave by the nearest face.
      const out = [[c.x0 - body - x, 0], [c.x1 + body - x, 0], [0, c.z0 - body - z], [0, c.z1 + body - z]]
        .sort((p, q) => Math.hypot(...p) - Math.hypot(...q))[0];
      x += out[0]; z += out[1];
    }
  }
  return [clamp(x, bounds.minX, bounds.maxX), clamp(z, bounds.minZ, bounds.maxZ)];
}

/**
 * Slice triangles with horizontal planes and return the cuts as segments. A wall with a doorway
 * comes back in two pieces with a gap, so the doorway stays walkable; slicing at a low and a waist
 * height closes window openings, whose sills are above the low cut.
 * `triangles` yields [ax, ay, az, bx, by, bz, cx, cy, cz] in world space.
 */
export function sliceTriangles(triangles, heights = [0.3, 1.1], minLength = 0.01) {
  const out = [];
  for (const t of triangles) {
    for (const y of heights) {
      const pts = [];
      for (const [i, j] of [[0, 3], [3, 6], [6, 0]]) {
        const ya = t[i + 1] - y, yb = t[j + 1] - y;
        if ((ya < 0) === (yb < 0) || ya === yb) continue;
        const k = ya / (ya - yb);
        pts.push([t[i] + (t[j] - t[i]) * k, t[i + 2] + (t[j + 2] - t[i + 2]) * k]);
      }
      if (pts.length === 2 && Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) >= minLength)
        out.push({ ax: pts[0][0], az: pts[0][1], bx: pts[1][0], bz: pts[1][1] });
    }
  }
  return out;
}

/** World-space triangles of three.js meshes (updates their world matrices first). */
export function* meshTriangles(meshes) {
  for (const m of meshes) {
    m.updateWorldMatrix(true, false);
    const e = m.matrixWorld.elements, pos = m.geometry.attributes.position, idx = m.geometry.index;
    const n = idx ? idx.count : pos.count;
    const w = (i) => {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];
    };
    for (let i = 0; i + 2 < n; i += 3) {
      const a = idx ? idx.getX(i) : i, b = idx ? idx.getX(i + 1) : i + 1, c = idx ? idx.getX(i + 2) : i + 2;
      yield [...w(a), ...w(b), ...w(c)];
    }
  }
}

/** Colliders for scanned wall meshes: slice them at a low and a waist height. */
export function collidersFromMeshes(meshes, heights) {
  return sliceTriangles(meshTriangles(meshes), heights);
}
