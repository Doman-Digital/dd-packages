import { describe, expect, it } from "vitest";
import { AI_SOURCE_TYPES, PROVENANCE_SCAN_BYTES, scanProvenance } from "../snapshot/provenance.js";
import { stockAvatarSource, stockSource } from "../snapshot/imagery-tells.js";
import { AI_IRI, jumbfC2pa, png, xmpChunk, xmpPacket } from "./image-bytes.js";

/**
 * Phase M: where a picture came from. The provenance scan is proved on real
 * PNG files with the metadata written where a generator writes it; the stock
 * matchers on the URLs a page actually loads.
 */

describe("scanProvenance", () => {
  it("finds a trained-model source type in an XMP packet", () => {
    const p = scanProvenance(png(4, 4, [xmpChunk(xmpPacket(AI_IRI))]));
    expect(p).toMatchObject({ digitalSourceType: "trainedAlgorithmicMedia", source: "xmp", c2pa: false });
  });

  it("names the composite type rather than the shorter one inside it", () => {
    const p = scanProvenance(png(4, 4, [xmpChunk(xmpPacket("http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia"))]));
    expect(p.digitalSourceType).toBe("compositeWithTrainedAlgorithmicMedia");
    expect(AI_SOURCE_TYPES).toContain(p.digitalSourceType);
  });

  it("finds it in a C2PA manifest, and records the manifest either way", () => {
    const withType = scanProvenance(png(4, 4, [{ type: "caBX", data: jumbfC2pa(`c2pa.actions digitalSourceType ${AI_IRI}`) }]));
    expect(withType).toMatchObject({ digitalSourceType: "trainedAlgorithmicMedia", source: "c2pa", c2pa: true });
    const credentialsOnly = scanProvenance(png(4, 4, [{ type: "caBX", data: jumbfC2pa("c2pa.actions c2pa.edited") }]));
    expect(credentialsOnly).toMatchObject({ digitalSourceType: null, c2pa: true });
  });

  it("says nothing about a file with no marker, or a camera's own source type", () => {
    expect(scanProvenance(png(4, 4))).toMatchObject({ digitalSourceType: null, source: null, c2pa: false });
    const camera = scanProvenance(png(4, 4, [xmpChunk(xmpPacket("http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture"))]));
    expect(camera.digitalSourceType).toBeNull();
  });

  it("marks a bare marker outside XMP and C2PA as other", () => {
    const p = scanProvenance(png(4, 4, [{ type: "tEXt", data: Buffer.from(`Comment\0${AI_IRI}`, "latin1") }]));
    expect(p).toMatchObject({ digitalSourceType: "trainedAlgorithmicMedia", source: "other" });
  });

  it("reads only the first 256 KB, so metadata after a large image is missed", () => {
    // The documented blind spot: a PNG may keep its XMP after the pixels.
    const big = { type: "tEXt", data: Buffer.alloc(PROVENANCE_SCAN_BYTES, 0x20) };
    const late = scanProvenance(png(4, 4, [big], [xmpChunk(xmpPacket(AI_IRI))]));
    expect(late.digitalSourceType).toBeNull();
    expect(late.bytes).toBe(PROVENANCE_SCAN_BYTES);
  });
});

describe("stock sources", () => {
  const at = (src: string) => {
    let host: string | null = null;
    try {
      host = new URL(src).hostname;
    } catch {
      host = null;
    }
    return { src, host };
  };

  it("knows the libraries by host, subdomains included", () => {
    expect(stockSource(at("https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1600"))).toBe("Unsplash");
    expect(stockSource(at("https://t4.ftcdn.net/jpg/01/23/45/67/360_F_1234.jpg"))).toBe("Adobe Stock");
    expect(stockSource(at("https://media.istockphoto.com/id/123/photo/plumber.jpg"))).toBe("iStock");
    expect(stockSource(at("https://picsum.photos/800/600"))).toBe("Lorem Picsum");
  });

  it("knows a downloaded picture by the library's file name", () => {
    expect(stockSource(at("https://acme.test/img/shutterstock_1234567890.jpg"))).toBe("Shutterstock");
    expect(stockSource(at("https://acme.test/img/iStock-987654321.jpg"))).toBe("iStock");
    expect(stockSource(at("https://acme.test/img/AdobeStock_445566.jpeg"))).toBe("Adobe Stock");
    expect(stockSource(at("https://acme.test/img/john-smith-a1B2c3D4e5-unsplash.jpg"))).toBe("Unsplash");
    expect(stockSource(at("https://acme.test/_next/static/media/photo-1581578731548-c64695cc6952.webp"))).toBe("Unsplash");
    expect(stockSource(at("https://acme.test/uploads/pexels-cottonbro-5691622.jpg"))).toBe("Pexels");
  });

  it("does not take a client's own files or a lookalike domain for stock", () => {
    for (const src of [
      "https://acme.test/img/boiler-swap-hinton.jpg",
      "https://acme.test/img/team-2024.jpg",
      "https://notunsplash.com/a.jpg",
      "https://acme.test/img/photo-2023-06-01.jpg",
      "https://acme.test/istockton-office.jpg",
    ]) {
      expect(stockSource(at(src)), src).toBeNull();
    }
  });

  it("knows placeholder-face services for avatars, and stock libraries too", () => {
    expect(stockAvatarSource(at("https://i.pravatar.cc/150?img=3"))).toBe("Pravatar");
    expect(stockAvatarSource(at("https://randomuser.me/api/portraits/women/44.jpg"))).toBe("randomuser.me");
    expect(stockAvatarSource(at("https://api.dicebear.com/7.x/avataaars/svg?seed=Sam"))).toBe("DiceBear");
    expect(stockAvatarSource(at("https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=faces"))).toBe("Unsplash");
    expect(stockAvatarSource(at("https://acme.test/team/sam.jpg"))).toBeNull();
  });
});
