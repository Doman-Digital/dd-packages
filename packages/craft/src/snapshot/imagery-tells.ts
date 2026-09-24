/**
 * Imagery and provenance: what the pictures on a rendered page say about
 * where they came from.
 *
 * A page built with no assets reaches for three things: a stock library, a
 * generator, or no pictures at all and a grid of icons where the work should
 * be. Each is visible in the snapshot's `images`. A snapshot taken before
 * craft recorded images has none, and none of these tells judges it.
 *
 * Each fix keeps the page's job and changes the evidence: a photo of the
 * client's own work in place of a library one.
 */

import type { Hit, RenderedTell } from "../character/types.js";
import { makeSnapshot } from "./fixture.js";
import type { Snapshot, SnapshotImage } from "./types.js";

const hit = (s: Snapshot, message: string, excerpt?: string): Hit => ({ path: s.url, offset: 0, message, excerpt: excerpt ?? message });

/** Stock libraries and placeholder services, by the domain they serve images from. */
export const STOCK_PHOTO_HOSTS: Readonly<Record<string, string>> = {
  "unsplash.com": "Unsplash",
  "pexels.com": "Pexels",
  "pixabay.com": "Pixabay",
  "istockphoto.com": "iStock",
  "gettyimages.com": "Getty Images",
  "shutterstock.com": "Shutterstock",
  "ftcdn.net": "Adobe Stock",
  "dreamstime.com": "Dreamstime",
  "depositphotos.com": "Depositphotos",
  "freepik.com": "Freepik",
  "rawpixel.com": "rawpixel",
  "stocksnap.io": "StockSnap",
  "burst.shopifycdn.com": "Burst",
  "picsum.photos": "Lorem Picsum",
  "loremflickr.com": "LoremFlickr",
  "placehold.co": "a placeholder service",
  "placeholder.com": "a placeholder service",
  "dummyimage.com": "a placeholder service",
};

/** Services that hand out a face on request: placeholder portraits and generated people. */
export const STOCK_AVATAR_HOSTS: Readonly<Record<string, string>> = {
  "randomuser.me": "randomuser.me",
  "pravatar.cc": "Pravatar",
  "dicebear.com": "DiceBear",
  "xsgames.co": "a random-face service",
  "thispersondoesnotexist.com": "a generated face",
  "generated.photos": "a generated face",
};

/** A stock library's own file naming, for pictures downloaded and self-hosted. */
const STOCK_FILENAMES: [RegExp, string][] = [
  [/(?:^|[/_-])shutterstock[_-]?\d{4,}/i, "Shutterstock"],
  [/(?:^|[/_-])istock(?:photo)?[_-]?\d{4,}/i, "iStock"],
  [/(?:^|[/_-])adobestock[_-]?\d{4,}/i, "Adobe Stock"],
  [/(?:^|[/_-])gettyimages[_-]?\d{4,}/i, "Getty Images"],
  [/(?:^|[/_-])depositphotos[_-]?\d{4,}/i, "Depositphotos"],
  [/(?:^|[/_-])dreamstime[_-]/i, "Dreamstime"],
  [/(?:^|[/_-])pexels-[a-z0-9-]*\d{4,}/i, "Pexels"],
  [/-unsplash\.(?:jpe?g|png|webp|avif)(?:[?#]|$)/i, "Unsplash"],
  // Unsplash's photo ids: photo-<13-digit timestamp>-<12 hex>.
  [/photo-1\d{12}-[0-9a-f]{12}/, "Unsplash"],
];

const byHost = (host: string | null, table: Readonly<Record<string, string>>): string | null => {
  if (!host) return null;
  const h = host.toLowerCase();
  for (const [domain, name] of Object.entries(table)) if (h === domain || h.endsWith(`.${domain}`)) return name;
  return null;
};

/** Where a stock picture came from, by host or by file name, or null. */
export function stockSource(image: Pick<SnapshotImage, "src" | "host">): string | null {
  const host = byHost(image.host, STOCK_PHOTO_HOSTS);
  if (host) return host;
  // The path alone, without scheme, host, query or fragment. No URL class: the
  // core stays free of DOM and Node globals.
  let path = image.src.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i, "").replace(/[?#].*$/, "");
  try {
    path = decodeURIComponent(path);
  } catch {
    // a malformed escape: read it as it is
  }
  for (const [re, name] of STOCK_FILENAMES) if (re.test(path)) return name;
  return null;
}

/** The placeholder-face service an avatar came from, or a stock library, or null. */
export function stockAvatarSource(image: Pick<SnapshotImage, "src" | "host">): string | null {
  return byHost(image.host, STOCK_AVATAR_HOSTS) ?? stockSource(image);
}

const picture = (patch: Partial<SnapshotImage> = {}): SnapshotImage => ({
  src: "https://example.test/images/boiler-swap-hinton.jpg",
  host: "example.test",
  width: 640,
  height: 480,
  top: 1800,
  role: "photo",
  alt: "The new combi boiler fitted in a kitchen cupboard in Hinton",
  decorative: false,
  section: 2,
  background: false,
  ...patch,
});

const withImages = (images: SnapshotImage[]): Snapshot => ({ ...makeSnapshot(), images });

const AI_XMP = { digitalSourceType: "trainedAlgorithmicMedia", source: "xmp" as const, c2pa: false, bytes: 48_000 };
const NOTHING = { digitalSourceType: null, source: null, c2pa: false, bytes: 48_000 };

const count = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

export const IMAGERY_TELLS: RenderedTell[] = [
  {
    id: "stock-photo",
    name: "Stock photography",
    generation: 1,
    severity: "warn",
    surface: "rendered",
    why: "A picture from a stock library is the picture every other site in the trade can use. It shows a job the client did not do, in a kitchen that is not theirs, and a visitor who has seen it before stops believing the rest.",
    fix: "Use a photo of the client's own work, premises or people, even a plain one taken on a phone. Where there is none yet, use fewer pictures rather than a library one.",
    rendered: {
      detect: (s) => {
        const found = (s.images ?? []).filter((i) => i.role === "photo" || i.role === "illustration").map((i) => ({ image: i, from: stockSource(i) })).filter((x) => x.from);
        if (found.length === 0) return [];
        const names = [...new Set(found.map((x) => x.from))].join(", ");
        return [hit(s, `${count(found.length, "picture")} from ${names}`, found[0].image.src)];
      },
      fixtures: {
        flag: [
          withImages([picture({ src: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=1600", host: "images.unsplash.com", alt: "Plumber fixing a sink" })]),
          // Downloaded and self-hosted, found by the library's own file name.
          withImages([picture({ src: "https://example.test/img/shutterstock_1234567890.jpg" })]),
        ],
        pass: [makeSnapshot(), withImages([picture()]), withImages([picture({ role: "icon", width: 48, height: 48, src: "https://images.unsplash.com/photo-1581578731548-c64695cc6952", host: "images.unsplash.com" })])],
      },
    },
  },
  {
    id: "stock-avatar",
    name: "Stock or placeholder faces",
    generation: 1,
    severity: "warn",
    surface: "rendered",
    why: "Round portraits from a placeholder-face service or a stock library next to reviews make every quote read as invented, and some of those faces are generated people who do not exist.",
    fix: "Drop the portraits. Name the reviewer, the town and the job, and link the review to where it was left.",
    rendered: {
      detect: (s) => {
        const found = (s.images ?? []).filter((i) => i.role === "avatar").map((i) => ({ image: i, from: stockAvatarSource(i) })).filter((x) => x.from);
        if (found.length === 0) return [];
        const names = [...new Set(found.map((x) => x.from))].join(", ");
        return [hit(s, `${count(found.length, "portrait")} from ${names}`, found[0].image.src)];
      },
      fixtures: {
        flag: [
          withImages([picture(), picture({ role: "avatar", width: 56, height: 56, src: "https://i.pravatar.cc/150?img=12", host: "i.pravatar.cc", alt: "Sarah" })]),
          withImages([picture({ role: "avatar", width: 64, height: 64, src: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?crop=faces", host: "images.unsplash.com" })]),
        ],
        pass: [makeSnapshot(), withImages([picture(), picture({ role: "avatar", width: 56, height: 56, src: "https://example.test/team/sam.jpg", alt: "Sam, engineer" })])],
      },
    },
  },
  {
    id: "ai-image",
    name: "Generated image",
    generation: 2,
    severity: "warn",
    surface: "rendered",
    why: "The file itself says a model made it (its XMP or Content Credentials name a trained-model source). A generated picture stands in for work the client did not photograph, and anyone can read the label.",
    fix: "Replace it with a photo of the real thing: the work, the premises, the people. Where there is none yet, use fewer pictures.",
    rendered: {
      detect: (s) => {
        const found = (s.images ?? []).filter((i) => i.provenance?.digitalSourceType);
        if (found.length === 0) return [];
        const first = found[0].provenance!;
        const where = first.source === "xmp" ? "its XMP metadata" : first.source === "c2pa" ? "its Content Credentials" : "its metadata";
        return [hit(s, `${count(found.length, "image")} labelled as made by a generative model (${first.digitalSourceType} in ${where})`, found[0].src)];
      },
      fixtures: {
        flag: [
          withImages([picture({ provenance: AI_XMP })]),
          withImages([picture({ provenance: { digitalSourceType: "compositeWithTrainedAlgorithmicMedia", source: "c2pa", c2pa: true, bytes: 120_000 } })]),
        ],
        // Credentials that say nothing about a model, and an image never read, are not findings.
        pass: [makeSnapshot(), withImages([picture({ provenance: NOTHING })]), withImages([picture({ provenance: { ...NOTHING, c2pa: true } })]), withImages([picture()])],
      },
    },
  },
  {
    id: "no-real-imagery",
    name: "No photograph on the page",
    generation: 1,
    severity: "warn",
    surface: "rendered",
    why: "A page with no photograph at all, only icons and illustrations, is the page a model builds when it has no assets. Icon tiles stand in for the evidence a buyer looks for: the work, the premises, the people.",
    fix: "Add one real photo of the work where the claim is made: a finished job next to the service, the team next to the booking. One plain photo beats any number of icons.",
    rendered: {
      detect: (s) => {
        if (!s.images || s.sections.length < 4) return [];
        if (s.images.some((i) => i.role === "photo")) return [];
        const icons = s.images.filter((i) => i.role === "icon" || i.role === "illustration").length;
        return [hit(s, `no photograph on the page${icons ? `: ${count(icons, "icon or illustration", "icons and illustrations")} instead` : ""}`)];
      },
      fixtures: {
        flag: [
          withImages([picture({ role: "icon", width: 48, height: 48, src: "https://example.test/icons/wrench.svg" }), picture({ role: "illustration", width: 480, height: 360, src: "https://example.test/hero.svg" })]),
          withImages([]),
        ],
        // A snapshot with no image record is never judged; nor is a page too short to be a site.
        pass: [makeSnapshot(), withImages([picture()]), { ...withImages([]), sections: makeSnapshot().sections.slice(0, 3) }],
      },
    },
  },
];
