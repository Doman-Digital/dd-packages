import { crc32, deflateSync } from "node:zlib";

/**
 * Real image files for the provenance tests: a valid PNG, with metadata where
 * a generator would put it. Not a test file itself.
 */

export const AI_IRI = "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia";

/** An XMP packet naming a digital source type, as a generator writes it. */
export const xmpPacket = (sourceType: string): string =>
  `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:Iptc4xmpExt="http://iptc.org/std/Iptc4xmpExt/2008-02-29/" Iptc4xmpExt:DigitalSourceType="${sourceType}"/></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;

const chunk = (type: string, data: Uint8Array): Buffer => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** An iTXt chunk carrying an XMP packet, keyed the way Adobe's XMP spec says. */
export const xmpChunk = (xmp: string) => ({ type: "iTXt", data: Buffer.from(`XML:com.adobe.xmp\0\0\0\0\0${xmp}`, "utf8") });

/** A C2PA manifest's JUMBF description box: `jumd`, a 16-byte type UUID, a toggle byte, the label. */
export const jumbfC2pa = (payload = ""): Buffer =>
  Buffer.concat([Buffer.from("jumb", "latin1"), Buffer.from("jumd", "latin1"), Buffer.from("6332706100110010800000aa00389b71", "hex"), Buffer.from([3]), Buffer.from(`c2pa\0${payload}`, "latin1")]);

/** A width by height grey PNG, with any extra chunks before the pixels (or after, with `trailing`). */
export function png(width: number, height: number, extra: { type: string; data: Uint8Array }[] = [], trailing: { type: string; data: Uint8Array }[] = []): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // greyscale
  const rows = Buffer.alloc((width + 1) * height, 0x99);
  for (let y = 0; y < height; y += 1) rows[y * (width + 1)] = 0; // filter byte
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    ...extra.map((c) => chunk(c.type, c.data)),
    chunk("IDAT", deflateSync(rows)),
    ...trailing.map((c) => chunk(c.type, c.data)),
    chunk("IEND", new Uint8Array()),
  ]);
}
