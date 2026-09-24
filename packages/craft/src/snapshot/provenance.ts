/**
 * Where an image came from, as far as its own bytes say.
 *
 * Generators that label their output do it in one of two places: an XMP
 * packet (Adobe's metadata format, in JPEG, PNG, WebP and AVIF) or a C2PA
 * manifest (Content Credentials, a JUMBF box). Both name the IPTC digital
 * source type, and two of its values mean a trained model made the picture:
 *
 *   http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia
 *   http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia
 *
 * This is a byte scan with no parser and no dependency: the IRI is plain text
 * in XMP and a CBOR text string in C2PA, so it reads the same either way.
 *
 * Only a positive is evidence. Most images carry no metadata, every CMS and
 * image optimiser that re-encodes strips it, and a PNG can keep its metadata
 * after the pixels, beyond what is read. No marker proves nothing, and this
 * never says an image is real.
 */

import type { ImageProvenance } from "./types.js";

/** Bytes read from the start of a file. JPEG and WebP metadata sit well inside it. */
export const PROVENANCE_SCAN_BYTES = 256 * 1024;

/** The IPTC digital source types that mean a trained model made the image, most specific first. */
export const AI_SOURCE_TYPES = ["compositeWithTrainedAlgorithmicMedia", "trainedAlgorithmicMedia"] as const;

const MARKER = new RegExp(`(?:${AI_SOURCE_TYPES.join("|")})`);
/** A JUMBF description box labelled c2pa: `jumd`, a 16-byte type UUID, a toggle byte, then the label. */
const C2PA_BOX = /jumd[\s\S]{16,24}c2pa/;
/** PNG's chunk for C2PA manifests. */
const C2PA_PNG = /caBX/;

/** Bytes as a Latin-1 string: one character per byte, so offsets line up. */
function latin1(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    out += String.fromCharCode(...bytes.subarray(i, Math.min(bytes.length, i + 8192)));
  }
  return out;
}

/** Every XMP packet in the text, as [start, end) offsets. */
function xmpPackets(text: string): [number, number][] {
  const out: [number, number][] = [];
  const open = /<x:xmpmeta\b|<\?xpacket begin/g;
  let m: RegExpExecArray | null;
  while ((m = open.exec(text))) {
    const close = text.indexOf(m[0].startsWith("<x:") ? "</x:xmpmeta>" : "<?xpacket end", m.index);
    out.push([m.index, close === -1 ? text.length : close]);
    if (close === -1) break;
    open.lastIndex = close;
  }
  return out;
}

/** Read an image's leading bytes for an AI digital source type. Pure. */
export function scanProvenance(bytes: Uint8Array): ImageProvenance {
  const head = bytes.subarray(0, PROVENANCE_SCAN_BYTES);
  const text = latin1(head);
  const c2pa = C2PA_BOX.test(text) || (text.startsWith("\x89PNG") && C2PA_PNG.test(text));
  const m = MARKER.exec(text);
  if (!m) return { digitalSourceType: null, source: null, c2pa, bytes: head.length };
  const inXmp = xmpPackets(text).some(([a, b]) => m.index >= a && m.index < b);
  return { digitalSourceType: m[0], source: inXmp ? "xmp" : c2pa ? "c2pa" : "other", c2pa, bytes: head.length };
}
