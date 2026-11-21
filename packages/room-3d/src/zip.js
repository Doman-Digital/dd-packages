// A minimal zip writer (stored, no compression) with no dependencies: the agent pack's container.
// PNG and GLB are already compressed, and the text files are small, so storing loses little.

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
export function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const enc = new TextEncoder();
const toBytes = (d) => (typeof d === 'string' ? enc.encode(d) : d instanceof Uint8Array ? d : new Uint8Array(d));

/**
 * @param {{ name: string, data: string | Uint8Array | ArrayBuffer }[]} files  names use forward slashes
 * @param {Date} [when]
 * @returns {Uint8Array}
 */
export function zip(files, when = new Date()) {
  const time = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1);
  const date = ((Math.max(1980, when.getFullYear()) - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate();
  const locals = [], centrals = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name), data = toBytes(f.data), crc = crc32(data);
    const head = (sig, central) => {
      const b = new Uint8Array((central ? 46 : 30) + name.length), v = new DataView(b.buffer);
      let p = 0;
      const u32 = (x) => { v.setUint32(p, x >>> 0, true); p += 4; }, u16 = (x) => { v.setUint16(p, x, true); p += 2; };
      u32(sig);
      if (central) u16(20); // made by
      u16(20); u16(0x0800); u16(0); u16(time); u16(date); // version, flags (UTF-8 names), stored, time, date
      u32(crc); u32(data.length); u32(data.length); u16(name.length); u16(0);
      if (central) { u16(0); u16(0); u16(0); u32(0); u32(offset); }
      b.set(name, p);
      return b;
    };
    const local = head(0x04034b50, false);
    centrals.push(head(0x02014b50, true));
    locals.push(local, data);
    offset += local.length + data.length;
  }
  const cdSize = centrals.reduce((n, b) => n + b.length, 0);
  const end = new Uint8Array(22), v = new DataView(end.buffer);
  v.setUint32(0, 0x06054b50, true); v.setUint16(8, files.length, true); v.setUint16(10, files.length, true);
  v.setUint32(12, cdSize, true); v.setUint32(16, offset, true);
  const parts = [...locals, ...centrals, end], out = new Uint8Array(parts.reduce((n, b) => n + b.length, 0));
  let p = 0; for (const b of parts) { out.set(b, p); p += b.length; }
  return out;
}
