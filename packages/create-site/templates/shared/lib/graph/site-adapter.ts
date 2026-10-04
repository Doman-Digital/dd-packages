// The site's facts, shaped for @domandigital/graph. Written by
// @domandigital/create-site. graph owns JSON-LD emission; this adapter only
// maps site.facts.ts onto OrganizationInput, which is why it lives here and
// not in a package (graph PRINCIPLES.md, principle 6).
//
// Two rules are enforced in code rather than remembered:
//   - sameAs lists only profiles marked "live". A profile still to claim is
//     not evidence of anything.
//   - An accreditation appears only once it has a register link and a date
//     someone checked it. Unchecked claims do not reach search engines.

import type { OrganizationInput } from "@domandigital/graph";

export type Day = "Mo" | "Tu" | "We" | "Th" | "Fr" | "Sa" | "Su";

export type OpeningHours = { days: Day[]; opens: string; closes: string };

export type Accreditation = {
  /** As the scheme names it, e.g. "NICEIC Approved Contractor". */
  name: string;
  /** The body, e.g. "NICEIC". */
  scheme: string;
  number: string | null;
  /** The client's own entry on the public register. */
  registerUrl: string | null;
  /** ISO date a person last checked the entry. */
  verifiedOn: string | null;
};

export type ProfileKind =
  | "google-business-profile"
  | "bing-places"
  | "apple-business-connect"
  | "directory"
  | "trade-register"
  | "companies-house"
  | "social";

export type Profile = {
  kind: ProfileKind;
  name: string;
  url: string | null;
  status: "to-claim" | "claimed" | "live";
};

/** A company the site sends personal data to, as the privacy and cookie pages list it. */
export type Processor = {
  name: string;
  /** What it does for the site, e.g. "hosting", "enquiry email". */
  purpose: string;
  /** Sets cookies in the visitor's browser. Measurement ones load only after consent. */
  setsCookies: boolean;
};

/**
 * What the privacy, cookie, terms and accessibility pages need. Unknown is
 * null; a page leaves out what is null rather than print a placeholder, and
 * launch:check fails until the ones every site needs are filled in.
 */
export type LegalFacts = {
  /** Companies House number. null for a sole trader or a partnership. */
  companyNumber: string | null;
  /** Registered office on one line, as Companies House shows it. */
  registeredOffice: string | null;
  /** ICO data protection fee registration number. */
  icoNumber: string | null;
  /** Where privacy requests go, if not the main email. */
  privacyEmail: string | null;
  /** How long enquiries and customer records are kept, in a sentence. */
  retention: string | null;
  processors: Processor[];
  /** The law the website terms are under, e.g. "England and Wales" or "Scotland". */
  governingLaw: string | null;
  /** Accessibility problems someone found and has not fixed yet. */
  accessibilityIssues: string[];
  /** ISO date someone last read the legal pages against what the site does. */
  reviewedOn: string | null;
};

export type SiteFacts = {
  /** The canonical origin, https, no trailing slash. */
  url: string;
  legalName: string;
  tradingName: string;
  /** One or two plain sentences: who, where, what. */
  description: string;
  /** schema.org types, most specific last, e.g. ["LocalBusiness", "Electrician"]. */
  businessTypes: string[];
  phone: string | null;
  email: string | null;
  address: {
    streetAddress: string | null;
    locality: string | null;
    region: string | null;
    postalCode: string | null;
    country: "GB";
  } | null;
  geo: { latitude: number; longitude: number } | null;
  openingHours: OpeningHours[];
  serviceAreas: string[];
  accreditations: Accreditation[];
  profiles: Profile[];
  /** Hostnames of previous sites that now redirect here, for the redirect check. */
  previousHosts: string[];
  /** Optional so a facts file written before the legal pages still compiles. */
  legal?: LegalFacts;
};

const DAY_NAMES: Record<Day, string> = {
  Mo: "Monday",
  Tu: "Tuesday",
  We: "Wednesday",
  Th: "Thursday",
  Fr: "Friday",
  Sa: "Saturday",
  Su: "Sunday",
};

export function toOrganizationInput(facts: SiteFacts): OrganizationInput {
  return {
    name: facts.tradingName,
    legalName: facts.legalName !== facts.tradingName ? facts.legalName : null,
    description: facts.description,
    url: facts.url,
    phone: facts.phone,
    email: facts.email,
    address: facts.address,
    geo: facts.geo ? { latitude: String(facts.geo.latitude), longitude: String(facts.geo.longitude) } : null,
    openingHoursSpecification: facts.openingHours.map((h) => ({
      dayOfWeek: h.days.map((d) => DAY_NAMES[d]),
      opens: h.opens,
      closes: h.closes,
    })),
    areaServed: facts.serviceAreas.length > 0 ? facts.serviceAreas : null,
    sameAs: facts.profiles.filter((p) => p.status === "live" && p.url).map((p) => p.url as string),
    identifiers: facts.accreditations
      .filter((a) => a.registerUrl && a.verifiedOn)
      .map((a) => ({ propertyID: a.scheme, name: a.name, value: a.number ?? a.name, url: a.registerUrl })),
  };
}
