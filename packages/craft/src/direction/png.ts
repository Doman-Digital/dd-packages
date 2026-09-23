/**
 * Just enough PNG to read the colours off a photo of a van: 8-bit RGB and
 * RGBA, grey and grey-alpha, non-interlaced. Node's own zlib, so craft keeps
 * no dependencies. Anything else says so and is skipped, never guessed at.
 *
 * CLI-only: this imports node:zlib and is never reached from the core import.
 */

import { inflateSync } from "node:zlib";

export function decodePng(buf: Uint8Array): { width: number; height: number; rgba: Uint8Array } {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!sig.every((b, i) => buf[i] === b)) throw new Error("not a PNG");
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let pos = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colour = 0;
  let interlace = 0;
  const idat: Uint8Array[] = [];
  while (pos < buf.length) {
    const len = view.getUint32(pos);
    const type = String.fromCharCode(...buf.subarray(pos + 4, pos + 8));
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === "IHDR") {
      width = view.getUint32(pos + 8);
      height = view.getUint32(pos + 12);
      depth = data[8];
      colour = data[9];
      interlace = data[12];
    } else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    pos += 12 + len;
  }
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colour as 0 | 2 | 4 | 6];
  if (depth !== 8 || !channels || interlace !== 0) throw new Error(`unsupported PNG (depth ${depth}, colour type ${colour}${interlace ? ", interlaced" : ""}); export it as 8-bit RGB`);
  const raw = inflateSync(Buffer.concat(idat.map((d) => Buffer.from(d))));
  const stride = width * channels;
  const out = new Uint8Array(width * height * 4);
  const prev = new Uint8Array(stride);
  const line = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x += 1) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = src[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[x] = v & 0xff;
    }
    for (let x = 0; x < width; x += 1) {
      const i = x * channels;
      const o = (y * width + x) * 4;
      if (channels >= 3) {
        out[o] = line[i];
        out[o + 1] = line[i + 1];
        out[o + 2] = line[i + 2];
        out[o + 3] = channels === 4 ? line[i + 3] : 255;
      } else {
        out[o] = out[o + 1] = out[o + 2] = line[i];
        out[o + 3] = channels === 2 ? line[i + 1] : 255;
      }
    }
    prev.set(line);
  }
  return { width, height, rgba: out };
}
