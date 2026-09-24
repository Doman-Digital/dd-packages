// Where a UK local business can be listed, by sector. The launch checklist is
// built from this: "Claim" holds only what the client already holds, the rest
// is listed with the condition that would make it apply. Nothing here is
// bought, and nothing here is a link to ask a stranger for.
//
// Each entry carries its own evidence. `website` says what a real listing on
// that register shows, and `checkedOn` is the date someone opened one. `null`
// means nobody has, and the checklist says "not checked" beside it. There is
// no date for the list as a whole: entries are checked, a list is not.
//
// Checked 2026-09-24 by rendering one real listing per register in a browser
// and reading the anchor to the business's own site: its `rel`, and the page's
// robots meta. "not-shown" is recorded only where the listing template has no
// website field at all; one listing with the field left empty proves nothing.
// Registers behind a CAPTCHA or a bot challenge could not be read that way and
// stay null, with the reason in `note`.

export type Sector = "trades" | "beauty" | "clinics" | "professional";

export const SECTORS: Record<Sector, { label: string; businessTypes: string[] }> = {
  trades: { label: "Trades and construction", businessTypes: ["LocalBusiness", "HomeAndConstructionBusiness"] },
  beauty: { label: "Beauty and hair", businessTypes: ["LocalBusiness", "HealthAndBeautyBusiness"] },
  clinics: { label: "Clinics and aesthetics", businessTypes: ["LocalBusiness", "MedicalBusiness"] },
  professional: { label: "Professional services", businessTypes: ["LocalBusiness", "ProfessionalService"] },
};

export type Register = {
  id: string;
  name: string;
  /** The register's own site, or null where there is no single one (councils, manufacturers). */
  url: string | null;
  /** When it applies. */
  condition: string;
  sectors: Sector[] | "all";
  /** Held by a person, not the business: goes on the practitioner, not the organisation. */
  personLevel?: boolean;
  /**
   * What a listing shows of the business's own website. "followed" is a link
   * with no nofollow, sponsored or ugc, on a page not marked nofollow. null:
   * not verified, and `note` says why.
   */
  website: WebsiteLink | null;
  /** YYYY-MM-DD on which a real listing was opened. Null exactly when `website` is. */
  checkedOn: string | null;
  /** The listing checked, or why none could be. */
  note: string;
};

export type WebsiteLink = "followed" | "nofollow" | "shown-unlinked" | "not-shown";

export const REGISTERS: Register[] = [
  { id: "gbp", name: "Google Business Profile", url: "https://business.google.com/", condition: "Every business with a place or a service area", sectors: "all", website: null, checkedOn: null, note: "Not a register: the platform is the listing, and its website button is the platform's own. Not measured." },
  { id: "bing-places", name: "Bing Places", url: "https://www.bingplaces.com/", condition: "Every business with a place or a service area", sectors: "all", website: null, checkedOn: null, note: "Not a register: the platform is the listing. Not measured." },
  { id: "apple-business-connect", name: "Apple Business Connect", url: "https://businessconnect.apple.com/", condition: "Every business with a place or a service area", sectors: "all", website: null, checkedOn: null, note: "Not a register: the platform is the listing. Not measured." },
  { id: "companies-house", name: "Companies House", url: "https://find-and-update.company-information.service.gov.uk/", condition: "Limited companies and LLPs: check the registered name matches site.facts.ts", sectors: "all", website: "not-shown", checkedOn: "2026-09-24", note: "Company overview page: name, number, address, status, officers. No website field." },
  { id: "ico", name: "ICO data protection fee register", url: "https://ico.org.uk/", condition: "Businesses that have paid the data protection fee", sectors: "all", website: "not-shown", checkedOn: "2026-09-24", note: "Register entry (ESDWebPages/Entry/...): name, reference, dates, tier, address, other names. No website field." },
  { id: "yell", name: "Yell", url: "https://www.yell.com/", condition: "One general UK directory, for consistent contact details", sectors: "all", website: null, checkedOn: null, note: "Bot challenge (403) to both curl and a headless browser." },

  { id: "gas-safe", name: "Gas Safe Register", url: "https://www.gassaferegister.co.uk/", condition: "Gas work", sectors: ["trades"], website: null, checkedOn: null, note: "Bot challenge (403) to both curl and a headless browser." },
  { id: "niceic", name: "NICEIC", url: "https://www.niceic.com/", condition: "Electrical contractors registered with NICEIC", sectors: ["trades"], website: null, checkedOn: null, note: "Search results load behind reCAPTCHA." },
  { id: "napit", name: "NAPIT", url: "https://www.napit.org.uk/", condition: "Contractors registered with NAPIT", sectors: ["trades"], website: null, checkedOn: null, note: "Member search is a CAPTCHA form; the indexed sample profile had lapsed." },
  { id: "oftec", name: "OFTEC", url: "https://www.oftec.org/", condition: "Oil heating work", sectors: ["trades"], website: "followed", checkedOn: "2026-09-24", note: "Technician detail page (find-a-technician/detail/?id=...): Website row, plain link." },
  { id: "hetas", name: "HETAS", url: "https://www.hetas.co.uk/", condition: "Solid fuel and stove installation", sectors: ["trades"], website: null, checkedOn: null, note: "Bot challenge (Cloudflare) on the installer pages." },
  { id: "fensa", name: "FENSA", url: "https://www.fensa.org.uk/", condition: "Window and door installation", sectors: ["trades"], website: null, checkedOn: null, note: "No listing reached: the installer search returned no results to a headless browser." },
  { id: "certass", name: "CERTASS", url: "https://www.certass.co.uk/", condition: "Window and door installation", sectors: ["trades"], website: null, checkedOn: null, note: "No listing reached: the site refuses curl (403) and no public listing URL was found." },
  { id: "mcs", name: "MCS", url: "https://mcscertified.com/", condition: "Heat pumps, solar and other renewables", sectors: ["trades"], website: "followed", checkedOn: "2026-09-24", note: "Find an Installer results: 'Visit Website', plain link; page robots index, follow." },
  { id: "trustmark", name: "TrustMark", url: "https://www.trustmark.org.uk/", condition: "TrustMark registered businesses", sectors: ["trades"], website: null, checkedOn: null, note: "No listing reached: indexed sample profiles return 'Business not found'." },
  { id: "fmb", name: "Federation of Master Builders", url: "https://www.fmb.org.uk/", condition: "FMB members", sectors: ["trades"], website: "followed", checkedOn: "2026-09-24", note: "Builder profile (fmb.org.uk/builder/...): 'Visit website', plain link; page robots index, follow." },
  { id: "buy-with-confidence", name: "Buy With Confidence", url: "https://www.buywithconfidence.gov.uk/", condition: "Where the local trading standards service runs it and the business is approved", sectors: ["trades"], website: null, checkedOn: null, note: "Search results return 403 to a headless browser." },
  { id: "installer-finders", name: "Manufacturer installer finders", url: null, condition: "Accredited installers of a brand that lists them (boilers, EV chargers, heat pumps)", sectors: ["trades"], website: null, checkedOn: null, note: "No single register: check the manufacturer's own finder." },

  { id: "babtac", name: "BABTAC", url: "https://www.babtac.com/", condition: "BABTAC members", sectors: ["beauty"], website: null, checkedOn: null, note: "No listing reached: salon search is a form, and no indexed listing page was found." },
  { id: "beauty-guild", name: "The Guild of Beauty Therapists", url: "https://www.beautyguild.com/", condition: "Guild members", sectors: ["beauty"], website: null, checkedOn: null, note: "No listing reached: the indexed sample directory entry returned 404." },
  { id: "council-licence", name: "Council special treatment licence or registration", url: null, condition: "Where the local council licenses the treatments offered", sectors: ["beauty", "clinics"], website: null, checkedOn: null, note: "No single register: each council publishes its own, if at all." },
  { id: "brand-salon-finders", name: "Product brand salon finders", url: null, condition: "Salons stocking or trained on a brand that lists them", sectors: ["beauty"], website: null, checkedOn: null, note: "No single register: check the brand's own finder." },
  { id: "fresha", name: "Fresha", url: "https://www.fresha.com/", condition: "If the business already takes bookings there", sectors: ["beauty"], website: "not-shown", checkedOn: "2026-09-24", note: "Venue page (fresha.com/a/...): the listing template has no website field." },
  { id: "treatwell", name: "Treatwell", url: "https://www.treatwell.co.uk/", condition: "If the business already takes bookings there", sectors: ["beauty"], website: "not-shown", checkedOn: "2026-09-24", note: "Venue page (treatwell.co.uk/place/...): the listing template has no website field." },

  { id: "cqc", name: "Care Quality Commission", url: "https://www.cqc.org.uk/", condition: "Only where the clinic carries out regulated activities", sectors: ["clinics"], website: "followed", checkedOn: "2026-09-24", note: "Location contact tab (cqc.org.uk/location/.../contact): Website row, plain link. The overview tab shows only address and phone." },
  { id: "save-face", name: "Save Face", url: "https://www.saveface.co.uk/", condition: "Accredited aesthetic practitioners", sectors: ["clinics"], website: "followed", checkedOn: "2026-09-24", note: "Clinic page (saveface.co.uk/en/clinic/...): 'Visit our website', plain link." },
  { id: "jccp", name: "JCCP", url: "https://www.jccp.org.uk/", condition: "Practitioners on the JCCP register", sectors: ["clinics"], website: null, checkedOn: null, note: "No listing reached: member search is a form." },
  { id: "gmc", name: "GMC register", url: "https://www.gmc-uk.org/", condition: "Doctors", sectors: ["clinics"], personLevel: true, website: null, checkedOn: null, note: "Bot challenge (403) to a headless browser." },
  { id: "nmc", name: "NMC register", url: "https://www.nmc.org.uk/", condition: "Nurses", sectors: ["clinics"], personLevel: true, website: null, checkedOn: null, note: "A register of individuals; no listing opened." },
  { id: "gdc", name: "GDC register", url: "https://www.gdc-uk.org/", condition: "Dentists and dental professionals", sectors: ["clinics"], personLevel: true, website: "not-shown", checkedOn: "2026-09-24", note: "Register result (olr.gdc-uk.org): status, titles, qualifications. No website field." },
  { id: "gphc", name: "GPhC register", url: "https://www.pharmacyregulation.org/", condition: "Pharmacists", sectors: ["clinics"], personLevel: true, website: null, checkedOn: null, note: "A register of individuals; no listing opened." },
  { id: "doctify", name: "Doctify", url: "https://www.doctify.com/", condition: "Clinics and practitioners listed there", sectors: ["clinics"], website: null, checkedOn: null, note: "Bot check (HTTP 202 interstitial) to a headless browser." },
  { id: "insurer-finders", name: "Private insurer practitioner finders", url: null, condition: "Clinics recognised by a private health insurer", sectors: ["clinics"], website: null, checkedOn: null, note: "No single register: check each insurer's own finder." },

  { id: "sra", name: "Solicitors Regulation Authority", url: "https://www.sra.org.uk/", condition: "SRA regulated firms", sectors: ["professional"], website: null, checkedOn: null, note: "Bot challenge (Cloudflare) on register pages." },
  { id: "law-society", name: "Law Society Find a Solicitor", url: "https://solicitors.lawsociety.org.uk/", condition: "Solicitors' firms", sectors: ["professional"], website: null, checkedOn: null, note: "No listing reached: indexed office pages return an error to a headless browser." },
  { id: "icaew", name: "ICAEW", url: "https://www.icaew.com/", condition: "ICAEW registered firms", sectors: ["professional"], website: null, checkedOn: null, note: "Bot challenge (Cloudflare) on find.icaew.com." },
  { id: "acca", name: "ACCA", url: "https://www.accaglobal.com/", condition: "ACCA practising members", sectors: ["professional"], website: null, checkedOn: null, note: "No listing reached: the firm search reported itself unavailable." },
  { id: "aat", name: "AAT", url: "https://www.aat.org.uk/", condition: "AAT licensed accountants", sectors: ["professional"], website: null, checkedOn: null, note: "No listing reached: the directory is a search form." },
  { id: "ciot", name: "Chartered Institute of Taxation", url: "https://www.tax.org.uk/", condition: "CIOT members", sectors: ["professional"], website: null, checkedOn: null, note: "No listing reached: member search is a form on the ATT/CIOT portal." },
  { id: "fca", name: "FCA register", url: "https://register.fca.org.uk/", condition: "FCA authorised firms", sectors: ["professional"], website: "followed", checkedOn: "2026-09-24", note: "Firm page (register.fca.org.uk/s/firm?id=...): the firm's website, plain link." },
  { id: "rics", name: "RICS Find a Surveyor", url: "https://www.ricsfirms.com/", condition: "RICS regulated firms", sectors: ["professional"], website: "followed", checkedOn: "2026-09-24", note: "Office page on ricsfirms.com, RICS's Find a Surveyor: website shown as a plain link." },
  { id: "arb", name: "Architects Registration Board", url: "https://arb.org.uk/", condition: "Architects", sectors: ["professional"], personLevel: true, website: null, checkedOn: null, note: "A register of individuals; no listing opened." },
];

export function registersFor(sector: Sector): Register[] {
  return REGISTERS.filter((r) => r.sectors === "all" || r.sectors.includes(sector));
}
