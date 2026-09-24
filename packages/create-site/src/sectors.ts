// Where a UK local business can be listed, by sector. The launch checklist is
// built from this: "Claim" holds only what the client already holds, the rest
// is listed with the condition that would make it apply. Nothing here is
// bought, and nothing here is a link to ask a stranger for.
//
// NOT YET CHECKED BY A PERSON. The names and homepages are well known; whether
// each register shows a business website, and how it links, has not been
// verified. REGISTERS_CHECKED_ON stays null until someone has opened every
// entry and confirmed it, and the checklist says so while it is null.

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
};

export const REGISTERS_CHECKED_ON: string | null = null;

export const REGISTERS: Register[] = [
  { id: "gbp", name: "Google Business Profile", url: "https://business.google.com/", condition: "Every business with a place or a service area", sectors: "all" },
  { id: "bing-places", name: "Bing Places", url: "https://www.bingplaces.com/", condition: "Every business with a place or a service area", sectors: "all" },
  { id: "apple-business-connect", name: "Apple Business Connect", url: "https://businessconnect.apple.com/", condition: "Every business with a place or a service area", sectors: "all" },
  { id: "companies-house", name: "Companies House", url: "https://find-and-update.company-information.service.gov.uk/", condition: "Limited companies and LLPs: check the registered name matches site.facts.ts", sectors: "all" },
  { id: "ico", name: "ICO data protection fee register", url: "https://ico.org.uk/", condition: "Businesses that have paid the data protection fee", sectors: "all" },
  { id: "yell", name: "Yell", url: "https://www.yell.com/", condition: "One general UK directory, for consistent contact details", sectors: "all" },

  { id: "gas-safe", name: "Gas Safe Register", url: "https://www.gassaferegister.co.uk/", condition: "Gas work", sectors: ["trades"] },
  { id: "niceic", name: "NICEIC", url: "https://www.niceic.com/", condition: "Electrical contractors registered with NICEIC", sectors: ["trades"] },
  { id: "napit", name: "NAPIT", url: "https://www.napit.org.uk/", condition: "Contractors registered with NAPIT", sectors: ["trades"] },
  { id: "oftec", name: "OFTEC", url: "https://www.oftec.org/", condition: "Oil heating work", sectors: ["trades"] },
  { id: "hetas", name: "HETAS", url: "https://www.hetas.co.uk/", condition: "Solid fuel and stove installation", sectors: ["trades"] },
  { id: "fensa", name: "FENSA", url: "https://www.fensa.org.uk/", condition: "Window and door installation", sectors: ["trades"] },
  { id: "certass", name: "CERTASS", url: "https://www.certass.co.uk/", condition: "Window and door installation", sectors: ["trades"] },
  { id: "mcs", name: "MCS", url: "https://mcscertified.com/", condition: "Heat pumps, solar and other renewables", sectors: ["trades"] },
  { id: "trustmark", name: "TrustMark", url: "https://www.trustmark.org.uk/", condition: "TrustMark registered businesses", sectors: ["trades"] },
  { id: "fmb", name: "Federation of Master Builders", url: "https://www.fmb.org.uk/", condition: "FMB members", sectors: ["trades"] },
  { id: "buy-with-confidence", name: "Buy With Confidence", url: "https://www.buywithconfidence.gov.uk/", condition: "Where the local trading standards service runs it and the business is approved", sectors: ["trades"] },
  { id: "installer-finders", name: "Manufacturer installer finders", url: null, condition: "Accredited installers of a brand that lists them (boilers, EV chargers, heat pumps)", sectors: ["trades"] },

  { id: "babtac", name: "BABTAC", url: "https://www.babtac.com/", condition: "BABTAC members", sectors: ["beauty"] },
  { id: "beauty-guild", name: "The Guild of Beauty Therapists", url: "https://www.beautyguild.com/", condition: "Guild members", sectors: ["beauty"] },
  { id: "council-licence", name: "Council special treatment licence or registration", url: null, condition: "Where the local council licenses the treatments offered", sectors: ["beauty", "clinics"] },
  { id: "brand-salon-finders", name: "Product brand salon finders", url: null, condition: "Salons stocking or trained on a brand that lists them", sectors: ["beauty"] },
  { id: "fresha", name: "Fresha", url: "https://www.fresha.com/", condition: "If the business already takes bookings there", sectors: ["beauty"] },
  { id: "treatwell", name: "Treatwell", url: "https://www.treatwell.co.uk/", condition: "If the business already takes bookings there", sectors: ["beauty"] },

  { id: "cqc", name: "Care Quality Commission", url: "https://www.cqc.org.uk/", condition: "Only where the clinic carries out regulated activities", sectors: ["clinics"] },
  { id: "save-face", name: "Save Face", url: "https://www.saveface.co.uk/", condition: "Accredited aesthetic practitioners", sectors: ["clinics"] },
  { id: "jccp", name: "JCCP", url: "https://www.jccp.org.uk/", condition: "Practitioners on the JCCP register", sectors: ["clinics"] },
  { id: "gmc", name: "GMC register", url: "https://www.gmc-uk.org/", condition: "Doctors", sectors: ["clinics"], personLevel: true },
  { id: "nmc", name: "NMC register", url: "https://www.nmc.org.uk/", condition: "Nurses", sectors: ["clinics"], personLevel: true },
  { id: "gdc", name: "GDC register", url: "https://www.gdc-uk.org/", condition: "Dentists and dental professionals", sectors: ["clinics"], personLevel: true },
  { id: "gphc", name: "GPhC register", url: "https://www.pharmacyregulation.org/", condition: "Pharmacists", sectors: ["clinics"], personLevel: true },
  { id: "doctify", name: "Doctify", url: "https://www.doctify.com/", condition: "Clinics and practitioners listed there", sectors: ["clinics"] },
  { id: "insurer-finders", name: "Private insurer practitioner finders", url: null, condition: "Clinics recognised by a private health insurer", sectors: ["clinics"] },

  { id: "sra", name: "Solicitors Regulation Authority", url: "https://www.sra.org.uk/", condition: "SRA regulated firms", sectors: ["professional"] },
  { id: "law-society", name: "Law Society Find a Solicitor", url: "https://solicitors.lawsociety.org.uk/", condition: "Solicitors' firms", sectors: ["professional"] },
  { id: "icaew", name: "ICAEW", url: "https://www.icaew.com/", condition: "ICAEW registered firms", sectors: ["professional"] },
  { id: "acca", name: "ACCA", url: "https://www.accaglobal.com/", condition: "ACCA practising members", sectors: ["professional"] },
  { id: "aat", name: "AAT", url: "https://www.aat.org.uk/", condition: "AAT licensed accountants", sectors: ["professional"] },
  { id: "ciot", name: "Chartered Institute of Taxation", url: "https://www.tax.org.uk/", condition: "CIOT members", sectors: ["professional"] },
  { id: "fca", name: "FCA register", url: "https://register.fca.org.uk/", condition: "FCA authorised firms", sectors: ["professional"] },
  { id: "rics", name: "RICS", url: "https://www.rics.org/", condition: "RICS regulated firms", sectors: ["professional"] },
  { id: "arb", name: "Architects Registration Board", url: "https://arb.org.uk/", condition: "Architects", sectors: ["professional"], personLevel: true },
];

export function registersFor(sector: Sector): Register[] {
  return REGISTERS.filter((r) => r.sectors === "all" || r.sectors.includes(sector));
}
