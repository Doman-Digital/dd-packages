/**
 * Tells that exist only on a rendered page: the stock components.
 *
 * A pricing trio with a "Most popular" badge, a centred band with one button,
 * an avatar carousel of testimonials: none of these is visible in one source
 * file, and all of them are visible on the page. They read the version 2
 * snapshot's `role`, `geometry` and section parts, so a version 1 snapshot
 * never trips them.
 *
 * Each changes the look, never the page grammar. The fix for a stock pricing
 * trio keeps the prices; the fix for a stock band keeps the call to action.
 */

import type { Hit, RenderedTell } from "../character/types.js";
import { PROMO_BADGE } from "../fingerprint/component.js";
import { makeSnapshot } from "./fixture.js";
import type { SectionGeometry, Snapshot, SnapshotSection } from "./types.js";

const hit = (s: Snapshot, message: string, excerpt?: string): Hit => ({ path: s.url, offset: 0, message, excerpt: excerpt ?? message });

const GROUND = "rgb(255, 255, 255)";
const BAND = "rgb(31, 58, 46)";

/** Geometry for fixtures: a left-aligned, wide section on the page ground. */
const geo = (patch: Partial<SectionGeometry> = {}): SectionGeometry => ({
  centredShare: 0.1,
  mirrorSymmetry: 0.6,
  whitespaceRatio: 0.7,
  contentWidthRatio: 0.85,
  background: GROUND,
  controls: 0,
  ...patch,
});

/** makeSnapshot's five sections as a version 2 capture, with `patch` applied to one of them. */
function withSection(index: number, patch: Partial<SnapshotSection>, roles: SnapshotSection["role"][] = []): Snapshot {
  const base = makeSnapshot();
  return {
    ...base,
    sections: base.sections.map((s, i) => ({ ...s, role: roles[i] ?? s.kind, geometry: geo(), badges: [], avatars: 0, carousel: false, figures: 0, ...(i === index ? patch : {}) })),
  };
}

const measured = (s: SnapshotSection): boolean => s.geometry !== undefined && s.role !== undefined;

export const RENDERED_TELLS: RenderedTell[] = [
  {
    id: "cta-band-stock",
    name: "Stock call-to-action band",
    generation: 1,
    severity: "warn",
    surface: "rendered",
    why: "A full-width coloured band with a centred heading, one line and one or two buttons is what a model closes every section run with. It asks for the booking the same way on every site.",
    fix: "Keep the ask, change the band: put it where the decision is made (next to the prices, after the proof), in the client's own words, laid out like the rest of the page rather than as a centred slab.",
    rendered: {
      detect: (s) =>
        s.sections
          .filter((x) => measured(x) && (x.role === "cta-band" || x.role === "footer-cta"))
          .filter((x) => {
            const g = x.geometry!;
            return g.centredShare >= 0.8 && g.background !== s.ground && g.controls >= 1 && g.controls <= 2 && g.contentWidthRatio <= 0.7;
          })
          .map((x) => hit(s, `a centred ${x.role === "footer-cta" ? "closing " : ""}band on its own colour with ${x.geometry!.controls === 1 ? "one button" : "two buttons"}`, x.label)),
      fixtures: {
        flag: [
          withSection(4, { role: "footer-cta", label: "Boiler out today?", geometry: geo({ centredShare: 1, background: BAND, controls: 1, contentWidthRatio: 0.45 }) }),
          withSection(3, { role: "cta-band", label: "Ready to book?", geometry: geo({ centredShare: 0.9, background: BAND, controls: 2, contentWidthRatio: 0.5 }) }),
        ],
        pass: [
          makeSnapshot(),
          // The same ask, laid out like the page: left-aligned on the ground.
          withSection(4, { role: "footer-cta", label: "Book a visit", geometry: geo({ centredShare: 0.1, background: GROUND, controls: 1, contentWidthRatio: 0.85 }) }),
        ],
      },
    },
  },
  {
    id: "pricing-trio-popular",
    name: "Three-tier pricing with a popular badge",
    generation: 1,
    severity: "warn",
    surface: "rendered",
    why: "Three price cards with the middle one badged 'Most popular' is the SaaS pricing page, applied to a plumber or a salon whether or not anyone chose the middle option.",
    fix: "Keep the prices. Show them the way the trade quotes (a price list, per job, per visit), and drop the badge unless it is true and the client can say how many people chose it.",
    rendered: {
      detect: (s) =>
        s.sections
          .filter((x) => measured(x) && x.role === "pricing" && x.cards === 3)
          .filter((x) => (x.badges ?? []).some((b) => PROMO_BADGE.test(b)))
          .map((x) => hit(s, `three price cards, one badged "${(x.badges ?? []).find((b) => PROMO_BADGE.test(b))}"`, x.label)),
      fixtures: {
        flag: [withSection(3, { role: "pricing", kind: "cards", cards: 3, badges: ["Most popular"], label: "Plans" })],
        pass: [
          makeSnapshot(),
          withSection(3, { role: "pricing", kind: "cards", cards: 3, badges: [], label: "Prices" }),
          withSection(3, { role: "pricing", kind: "text", cards: 0, badges: [], label: "Price list" }),
        ],
      },
    },
  },
  {
    id: "testimonial-avatar-carousel",
    name: "Avatar testimonial carousel",
    generation: 1,
    severity: "warn",
    surface: "rendered",
    why: "Round headshots over quotes in a sliding carousel is the stock testimonial block. Most visitors see the first slide only, and stock or AI faces make every quote read as invented.",
    fix: "Show the reviews all at once, where they come from (the Google rating, the named job, the town), with real photos of the work rather than of the reviewer.",
    rendered: {
      detect: (s) =>
        s.sections
          .filter((x) => measured(x) && x.role === "testimonials" && x.carousel === true && (x.avatars ?? 0) >= 2)
          .map((x) => hit(s, `${x.avatars} round portraits in a sliding testimonial carousel`, x.label)),
      fixtures: {
        flag: [withSection(2, { role: "testimonials", avatars: 3, carousel: true, label: "What our clients say" })],
        pass: [
          makeSnapshot(),
          withSection(2, { role: "testimonials", avatars: 3, carousel: false, label: "Reviews" }),
          withSection(2, { role: "testimonials", avatars: 0, carousel: true, label: "Reviews" }),
        ],
      },
    },
  },
  {
    id: "faq-accordion-closer",
    name: "FAQ accordion as the closer",
    generation: 2,
    severity: "warn",
    surface: "rendered",
    why: "Ending the page on a collapsed FAQ, often followed only by a band, is the model's default page ending. The answers a buyer needs are hidden behind clicks at the point they decide.",
    fix: "Answer the questions that block a booking where they arise (price next to prices, area next to the map), and end on the call to action or the proof.",
    rendered: {
      detect: (s) => {
        const body = s.sections.filter((x) => x.role !== "footer-cta" && x.role !== "cta-band");
        const last = body[body.length - 1];
        return last && measured(last) && last.role === "faq" ? [hit(s, "the page ends on a question-and-answer list", last.label)] : [];
      },
      fixtures: {
        flag: [
          withSection(4, { role: "faq", label: "Common questions" }),
          {
            ...withSection(3, { role: "faq", label: "FAQ" }),
            sections: withSection(3, { role: "faq", label: "FAQ" }).sections.map((x, i) => (i === 4 ? { ...x, role: "footer-cta" as const } : x)),
          },
        ],
        pass: [makeSnapshot(), withSection(2, { role: "faq", label: "Common questions" })],
      },
    },
  },
  {
    id: "stats-row",
    name: "Row of big numbers",
    generation: 1,
    severity: "warn",
    surface: "rendered",
    why: "Three or four large figures in a row (500+ clients, 98% satisfaction, 10 years) is the stock proof block, and the numbers are often round, unsourced or invented.",
    fix: "Keep a figure only if it is true and sourced, and put it in a sentence next to what it proves. One real number in context beats four in a row.",
    rendered: {
      detect: (s) =>
        s.sections
          // Straight after the hero is `hero-then-proof`'s finding; one hit per block.
          .filter((x, i) => measured(x) && (x.role === "stats" || x.kind === "stats") && (x.figures ?? 0) >= 3 && (x.figures ?? 0) <= 6 && !(i === 1 && s.sections[0]?.kind === "hero"))
          .map((x) => hit(s, `${x.figures} large figures in a row`, x.label)),
      fixtures: {
        flag: [withSection(3, { role: "stats", kind: "stats", figures: 4, label: "500+" })],
        pass: [
          makeSnapshot(),
          withSection(3, { role: "text", kind: "text", figures: 1, label: "Since 2009" }),
          withSection(1, { role: "stats", kind: "stats", figures: 4, label: "500+" }),
        ],
      },
    },
  },
  {
    id: "centred-everything",
    name: "Every section centred",
    generation: 2,
    severity: "warn",
    surface: "rendered",
    why: "When almost every section stacks a centred heading over centred text, the page has no reading line and every block looks like the one before. It is the layout nothing was decided for.",
    fix: "Pick an alignment and hold it: left-aligned text with a clear edge, keeping centring for the one moment that earns it.",
    rendered: {
      detect: (s) => {
        const m = s.sections.filter(measured);
        if (m.length < 4) return [];
        const centred = m.filter((x) => x.geometry!.centredShare >= 0.7).length;
        return centred / m.length >= 0.8 ? [hit(s, `${centred} of ${m.length} sections centre their text`)] : [];
      },
      fixtures: {
        flag: [{ ...makeSnapshot(), sections: makeSnapshot().sections.map((x) => ({ ...x, role: x.kind, geometry: geo({ centredShare: 0.9 }) })) }],
        pass: [
          makeSnapshot(),
          { ...makeSnapshot(), sections: makeSnapshot().sections.map((x, i) => ({ ...x, role: x.kind, geometry: geo({ centredShare: i < 2 ? 0.9 : 0.1 }) })) },
        ],
      },
    },
  },
];
