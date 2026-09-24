import { describe, expect, it } from "vitest";
import { createGraphIds } from "../ids";
import {
  buildArticle,
  buildBreadcrumbs,
  buildCollectionPage,
  buildContactPage,
  buildFAQPage,
  buildItemList,
  buildOfferCatalog,
  buildOrganization,
  buildPerson,
  buildPlace,
  buildProduct,
  buildReview,
  buildService,
  buildSoftwareApplication,
  buildWebPage,
  buildWebsite,
} from "../nodes";
import vocab from "./fixtures/schemaorg-vocab.json";

// Every key a builder emits must be a real schema.org property of the node's
// @type (or one of its supertypes), checked against a pinned snapshot of the
// vocabulary. See scripts/snapshot-vocab.mjs for why this is a test and not a
// type: `locality` shipped inside a conditional spread that tsc cannot see.

const TYPES = vocab.types as Record<string, string[]>;
const PROPERTIES = vocab.properties as Record<string, string[]>;
const SUPERSEDED = vocab.supersededBy as Record<string, string>;

function ancestors(type: string): Set<string> {
  const seen = new Set<string>();
  const queue = [type];
  while (queue.length > 0) {
    const t = queue.shift()!;
    if (seen.has(t)) continue;
    seen.add(t);
    queue.push(...(TYPES[t] ?? []));
  }
  return seen;
}

/** Every vocabulary problem in a node and everything nested under it. */
export function findVocabIssues(value: unknown, path = "$"): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => findVocabIssues(v, `${path}[${i}]`));
  if (!value || typeof value !== "object") return [];
  const node = value as Record<string, unknown>;
  const keys = Object.keys(node).filter((k) => !k.startsWith("@"));
  if (keys.length === 0) return []; // a pure {"@id"} ref

  const rawType = node["@type"];
  if (rawType === undefined) return [`${path}: nested object has no @type, so its keys cannot be checked`];
  const types = Array.isArray(rawType) ? (rawType as string[]) : [rawType as string];

  const issues: string[] = [];
  for (const t of types) {
    if (!(t in TYPES)) {
      issues.push(`${path}: @type ${t} is not in the vocabulary snapshot; add it to scripts/snapshot-vocab.mjs`);
    } else if (SUPERSEDED[t]) {
      issues.push(`${path}: @type ${t} is superseded by ${SUPERSEDED[t]}`);
    }
  }
  const allowedOn = new Set(types.flatMap((t) => [...ancestors(t)]));
  for (const key of keys) {
    const domains = PROPERTIES[key];
    if (!domains || !domains.some((d) => allowedOn.has(d))) {
      issues.push(`${path}: ${types.join("/")}.${key} is not a schema.org property of ${types.join("/")}`);
    } else if (SUPERSEDED[key]) {
      issues.push(`${path}: ${types.join("/")}.${key} is superseded by ${SUPERSEDED[key]}`);
    }
    issues.push(...findVocabIssues(node[key], `${path}.${key}`));
  }
  return issues;
}

const SITE_URL = "https://example-electrician.co.uk";
const ids = createGraphIds(SITE_URL);

// Every optional field populated, so every conditional branch is emitted.
const FULL_ORG = {
  name: "Acme Electrical",
  legalName: "Acme Electrical Ltd",
  alternateName: "Acme",
  description: "Domestic and commercial electricians.",
  url: SITE_URL,
  phone: "+44 20 0000 0000",
  email: "hello@example-electrician.co.uk",
  logoUrl: `${SITE_URL}/logo.png`,
  image: [`${SITE_URL}/van.jpg`],
  address: {
    streetAddress: "1 High Street",
    locality: "Uxbridge",
    region: "Greater London",
    postalCode: "UB8 1AA",
    country: "GB",
  },
  geo: { latitude: "51.5", longitude: "-0.48" },
  priceRange: "££",
  openingHours: "Mo-Fr 08:00-17:00",
  openingHoursSpecification: [{ dayOfWeek: ["Monday"], opens: "08:00", closes: "17:00" }],
  areaServed: ["Uxbridge", "Hillingdon"],
  sameAs: ["https://www.facebook.com/acme"],
  foundingDate: "2018",
  aggregateRating: { ratingValue: 4.9, reviewCount: 12 },
  hasOfferCatalog: buildOfferCatalog("Services", [{ slug: "rewiring" }], ids),
  founderId: ids.person("jo"),
  contactPoint: [
    { contactType: "customer service", email: "a@b.c", telephone: "1", areaServed: "GB", availableLanguage: ["en"] },
  ],
  identifiers: [{ propertyID: "Companies House", name: "Company number", value: "123", url: "https://x.test" }],
  hasMap: "https://maps.example/acme",
  paymentAccepted: "Cash, Card",
  currenciesAccepted: "GBP",
};

const BUILT: Record<string, unknown> = {
  "buildOrganization (LocalBusiness)": buildOrganization(FULL_ORG, ids),
  "buildOrganization (Electrician)": buildOrganization(FULL_ORG, ids, "Electrician"),
  "buildOrganization (areaServedIds)": buildOrganization(
    { ...FULL_ORG, areaServed: undefined, areaServedIds: [ids.place("uxbridge")] },
    ids,
  ),
  "buildOrganization (areaServedGeoCircle)": buildOrganization(
    { ...FULL_ORG, areaServed: undefined, areaServedGeoCircle: { latitude: 51.5, longitude: -0.48, radiusMeters: "15000" } },
    ids,
  ),
  buildWebsite: buildWebsite(
    {
      name: "Acme Electrical",
      url: SITE_URL,
      description: "Electricians in Uxbridge.",
      inLanguage: "en-GB",
      potentialAction: { type: "ReserveAction", targetUrlTemplate: `${SITE_URL}/book`, resultType: "Reservation" },
      speakable: { cssSelector: ["h1"] },
    },
    ids,
  ),
  buildPerson: buildPerson(
    {
      name: "Jo Bloggs",
      slug: "jo",
      jobTitle: "Electrician",
      description: "Founder.",
      imageUrl: `${SITE_URL}/jo.jpg`,
      sameAs: ["https://www.linkedin.com/in/jo"],
      credentials: [{ label: "NICEIC", number: "123", url: "https://niceic.test" }],
      hasCredential: [{ category: "Registration", name: "NICEIC Approved Contractor", identifier: "123", url: "https://niceic.test" }],
      hasOfferCatalog: buildOfferCatalog("Jo's services", [{ slug: "rewiring" }], ids),
    },
    ids,
  ),
  "buildPlace (postcodeArea)": buildPlace(
    { name: "Uxbridge", slug: "uxbridge", description: "Town.", postcodeArea: "UB8", county: "Greater London" },
    ids,
  ),
  "buildPlace (postcodes)": buildPlace({ name: "Uxbridge", slug: "uxbridge", postcodes: ["UB8 1AA"] }, ids),
  buildService: buildService(
    {
      name: "Rewiring",
      slug: "rewiring",
      description: "Full rewires.",
      serviceType: "Electrical",
      priceFromMinor: 250000,
      priceUnit: "per house",
      url: `${SITE_URL}/services/rewiring`,
    },
    ids,
  ),
  buildFAQPage: buildFAQPage([{ question: "Q?", answerText: "A." }], { id: `${SITE_URL}/faq#faq`, speakable: true }),
  buildBreadcrumbs: buildBreadcrumbs([{ name: "Home", url: SITE_URL }, { name: "Here" }], ids.breadcrumb("/x")),
  buildItemList: buildItemList([{ name: "A", url: `${SITE_URL}/a` }]),
  buildArticle: buildArticle(
    {
      slug: "guide",
      headline: "Guide",
      description: "About.",
      datePublished: "2026-01-01",
      dateModified: "2026-02-01",
      imageUrl: `${SITE_URL}/g.jpg`,
      authorSlug: "jo",
      speakable: { cssSelector: ["h1"] },
    },
    ids,
  ),
  buildWebPage: buildWebPage(
    { path: "/", url: SITE_URL, name: "Home", description: "Home.", dateModified: "2026-01-01", inLanguage: "en-GB" },
    ids,
  ),
  buildContactPage: buildContactPage({ path: "/contact", url: `${SITE_URL}/contact`, name: "Contact" }, ids),
  buildCollectionPage: buildCollectionPage(
    { path: "/services", url: `${SITE_URL}/services`, name: "Services", items: [{ name: "A", url: `${SITE_URL}/a` }], inLanguage: "en-GB" },
    ids,
  ),
  buildReview: buildReview(
    {
      authorName: "Sam",
      reviewBody: "Great.",
      ratingValue: 5,
      url: "https://g.page/r/x",
      datePublished: "2026-01-01",
      reply: { text: "Thanks.", dateCreated: "2026-01-02" },
    },
    ids,
  ),
  buildProduct: buildProduct(
    {
      slug: "van",
      name: "Van hire",
      url: `${SITE_URL}/van`,
      imageUrl: `${SITE_URL}/van.jpg`,
      brandName: "Ford",
      category: "Vans",
      description: "A van.",
      additionalProperty: [{ name: "Engine", value: "2.0" }],
      offers: {
        price: "80.00",
        priceCurrency: "GBP",
        unitText: "DAY",
        availability: "https://schema.org/PreOrder",
        availabilityStarts: "2026-10-01",
        sellerId: ids.org,
      },
      aggregateRating: { ratingValue: "4.8", reviewCount: "20" },
    },
    ids,
  ),
  buildSoftwareApplication: buildSoftwareApplication(
    {
      slug: "app",
      name: "App",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: "An app.",
      url: `${SITE_URL}/app`,
      publisherId: ids.org,
      offers: [{ name: "Monthly", price: "10.00", priceCurrency: "GBP", url: `${SITE_URL}/app/buy` }],
    },
    ids,
  ),
};

describe("vocabulary snapshot", () => {
  it("is pinned to a schema.org release", () => {
    expect(vocab.schemaVersion).toBe("30.1");
  });
});

describe("every builder emits only schema.org properties of its @type", () => {
  for (const [name, node] of Object.entries(BUILT)) {
    it(name, () => {
      expect(findVocabIssues(node)).toEqual([]);
    });
  }
});

describe("the check itself", () => {
  it("fails on the locality bug it exists to catch", () => {
    const node = { "@type": "PostalAddress", locality: "Uxbridge" };
    expect(findVocabIssues(node)).toEqual([
      "$: PostalAddress.locality is not a schema.org property of PostalAddress",
    ]);
  });

  it("accepts an inherited property (Organization.name via Thing)", () => {
    expect(findVocabIssues({ "@type": "Organization", name: "x" })).toEqual([]);
  });

  it("accepts a property valid on any one of several @types", () => {
    expect(findVocabIssues({ "@type": ["Person", "Place"], jobTitle: "x", hasMap: "y" })).toEqual([]);
  });

  it("refuses to pass a nested object it cannot type", () => {
    expect(findVocabIssues({ "@type": "Place", geo: { latitude: "1" } })).toEqual([
      "$.geo: nested object has no @type, so its keys cannot be checked",
    ]);
  });

  it("names a type missing from the snapshot rather than passing it", () => {
    expect(findVocabIssues({ "@type": "Plumber", name: "x" })[0]).toMatch(/Plumber is not in the vocabulary snapshot/);
  });

  it("flags a superseded property", () => {
    expect(findVocabIssues({ "@type": "LocalBusiness", map: "x" })).toEqual([
      "$: LocalBusiness.map is superseded by hasMap",
    ]);
  });
});
