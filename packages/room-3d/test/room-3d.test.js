import test from 'node:test';
import assert from 'node:assert/strict';
import { collide, sliceTriangles } from '../src/colliders.js';
import { zip, crc32 } from '../src/zip.js';

const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

test('a rectangle keeps the body 0.18 m clear, as hand-built walls expect', () => {
  const wall = [{ x0: -1, x1: 1, z0: -0.05, z1: 0.05 }];
  const [x, z] = collide(wall, 0, 0.1);
  assert.ok(near(x, 0) && near(z, 0.05 + 0.18));
  assert.deepEqual(collide(wall, 0, 1), [0, 1]); // far away: untouched
  const [, zi] = collide(wall, 0, 0.01); // inside the wall: out by the nearest face
  assert.ok(zi >= 0.05 + 0.18 - 1e-9);
});

test('a diagonal segment pushes along its normal, not its bounding box', () => {
  const seg = [{ ax: 0, az: 0, bx: 2, bz: 2 }];
  // (1.5, 0.2) is inside the bounding box but 0.92 m from the line: free.
  assert.deepEqual(collide(seg, 1.5, 0.2), [1.5, 0.2]);
  const [x, z] = collide(seg, 1.05, 0.95);
  assert.ok(near(Math.abs(x - z) / Math.SQRT2, 0.18, 1e-6));
});

test('bounds clamp the walker', () => {
  assert.deepEqual(collide([], 20, -20), [9, -9]);
  assert.deepEqual(collide([], 5, 5, 0.18, { minX: -1, maxX: 1, minZ: -2, maxZ: 2 }), [1, 2]);
});

// A wall along x from 0 to 3 m, 2.4 m tall, with a doorway from 1 to 1.8 m (2 m high) and a window
// from 2.2 to 2.8 m with its sill at 0.9 m. Front face only, as triangles.
function quad(x0, x1, y0, y1) { return [[x0, y0, 0, x1, y0, 0, x1, y1, 0], [x0, y0, 0, x1, y1, 0, x0, y1, 0]]; }
const wallTris = [
  ...quad(0, 1, 0, 2.4), ...quad(1, 1.8, 2, 2.4), ...quad(1.8, 2.2, 0, 2.4),
  ...quad(2.2, 2.8, 0, 0.9), ...quad(2.2, 2.8, 1.5, 2.4), ...quad(2.8, 3, 0, 2.4),
];

test('slicing a scanned wall leaves the doorway open and closes the window', () => {
  const segs = sliceTriangles(wallTris);
  const blocked = (x) => collide(segs, x, 0.05)[1] > 0.05 + 1e-6;
  assert.equal(blocked(1.4), false, 'doorway centre is walkable');
  assert.equal(blocked(0.5), true, 'solid wall stops you');
  assert.equal(blocked(2.5), true, 'window wall stops you (low cut)');
});

test('zip: stored entries with correct CRCs that a reader can walk', () => {
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
  const files = [{ name: 'a.md', data: '# hi\n' }, { name: 'views/b.bin', data: new Uint8Array([0, 1, 2, 255]) }];
  const z = zip(files, new Date(2026, 10, 21, 12, 0, 0));
  const v = new DataView(z.buffer);
  const end = z.length - 22;
  assert.equal(v.getUint32(end, true), 0x06054b50);
  assert.equal(v.getUint16(end + 10, true), 2);
  let p = v.getUint32(end + 16, true);
  const names = [];
  for (let i = 0; i < 2; i++) {
    assert.equal(v.getUint32(p, true), 0x02014b50);
    const n = v.getUint16(p + 28, true), size = v.getUint32(p + 20, true), off = v.getUint32(p + 42, true);
    const name = new TextDecoder().decode(z.subarray(p + 46, p + 46 + n));
    const ln = v.getUint16(off + 26, true), data = z.subarray(off + 30 + ln, off + 30 + ln + size);
    assert.equal(crc32(data), v.getUint32(p + 16, true));
    names.push(name); p += 46 + n;
  }
  assert.deepEqual(names, ['a.md', 'views/b.bin']);
});
