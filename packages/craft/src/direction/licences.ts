/**
 * What each face and icon set is licensed for, checked against the licensor's
 * own page. A face a client site ships without a licence covering that site is
 * a commercial risk the site owner carries, so `craft direction validate` warns
 * on a display or body face this register does not know, or knows only as
 * capped or unverified. Unverified is never a pass.
 *
 * This is a register of facts, not a shortlist. Nothing here is proposed to a
 * site: a face chosen because it is on this list is the agency's own reflex
 * font (CHARACTER.md, "Distance from the estate"). A face enters the register
 * after a site has chosen it for a reason and someone has read its licence.
 *
 * `licences.json` is generated from this file for tools outside the package.
 * Regenerate it with `pnpm --filter @domandigital/craft run docs`.
 */

export type LicenceSubject = "face" | "foundry" | "icons";

/**
 * Whether one purchase covers the sites Doman Digital builds for unrelated
 * clients. `yes`: it does. `capped`: up to `cap` sites. `per-site`: each client
 * site needs its own licence, in the client's name. `unverified`: nobody has
 * read the licensor's own terms yet.
 */
export type MultiClient = "yes" | "capped" | "per-site" | "unverified";

export interface LicenceEntry {
  /** The family name as CSS sets it, or the foundry or icon set's own name. */
  name: string;
  subject: LicenceSubject;
  licence: string;
  multiClient: MultiClient;
  /** How many sites one licence covers, when `multiClient` is `capped`. */
  cap?: number;
  /** When the licensor's page was read, ISO date. */
  checked: string;
  /** The licensor's own page. Never an aggregator. */
  source: string;
  note: string;
}

export const LICENCES: readonly LicenceEntry[] = [
  {
    name: "Basteleur",
    subject: "face",
    licence: "OFL-1.1",
    multiClient: "yes",
    checked: "2026-09-24",
    source: "https://velvetyne.fr/fonts/basteleur/",
    note: "Velvetyne, designed by Keussel. Keep the OFL notice with the font files.",
  },
  {
    name: "Gulax",
    subject: "face",
    licence: "OFL-1.1",
    multiClient: "yes",
    checked: "2026-09-24",
    source: "https://velvetyne.fr/fonts/gulax/",
    note: "Velvetyne. Keep the OFL notice with the font files.",
  },
  {
    name: "Le Murmure",
    subject: "face",
    licence: "OFL-1.1",
    multiClient: "yes",
    checked: "2026-09-24",
    source: "https://velvetyne.fr/fonts/le-murmure/",
    note: "Velvetyne. Keep the OFL notice with the font files.",
  },
  {
    name: "Blaze Type",
    subject: "foundry",
    licence: "commercial",
    multiClient: "per-site",
    cap: 10,
    checked: "2026-09-24",
    source: "https://blazetype.eu/eula",
    note: "The EULA sells a professional licence for 1 to 10 websites, and lets an agency buy in a client's name at the listed price. Its /license page says one licence covers every domain; the EULA is the contract, so buy per client.",
  },
  {
    name: "Power Type",
    subject: "foundry",
    licence: "commercial",
    multiClient: "unverified",
    checked: "2026-09-24",
    source: "https://power-type.com/eula",
    note: "Research on 2026-09-11 reported a Super License capped at 10 self-hosted domains. The EULA page did not load when checked; read it before relying on the cap.",
  },
  {
    name: "Grilli Type",
    subject: "foundry",
    licence: "commercial",
    multiClient: "per-site",
    checked: "2026-09-24",
    source: "https://www.grillitype.com/information",
    note: "Web licences cover any number of domains controlled by the licensee, priced by monthly visitors, so a client site needs the client's own licence. Unlimited tiers start at $10,000 per style.",
  },
  {
    name: "Phosphor",
    subject: "icons",
    licence: "MIT",
    multiClient: "yes",
    checked: "2026-09-24",
    source: "https://github.com/phosphor-icons/core/blob/main/LICENSE",
    note: "Six weights. The icon-tile tells treat it exactly as they treat Lucide: the library is not the tell, the tinted tile is.",
  },
  {
    name: "Tabler Icons",
    subject: "icons",
    licence: "MIT",
    multiClient: "yes",
    checked: "2026-09-24",
    source: "https://github.com/tabler/tabler-icons/blob/main/LICENSE",
    note: "One stroke grid across the set.",
  },
  {
    name: "Iconoir",
    subject: "icons",
    licence: "MIT",
    multiClient: "yes",
    checked: "2026-09-24",
    source: "https://github.com/iconoir-icons/iconoir/blob/main/LICENSE",
    note: "Smaller set, no paid tier.",
  },
  {
    name: "Unicons",
    subject: "icons",
    licence: "IconScout Simple License",
    multiClient: "yes",
    checked: "2026-09-24",
    source: "https://github.com/Iconscout/unicons/blob/master/LICENSE",
    note: "IconScout's free set, personal and commercial use, attribution optional.",
  },
  {
    name: "IconScout premium",
    subject: "icons",
    licence: "commercial",
    multiClient: "per-site",
    checked: "2026-09-24",
    source: "https://iconscout.com/licenses",
    note: "Each licence covers a single end product. Never in a tool, template or shared kit (create-site, craft, a house component library), even modified. Record the assets each site uses. Assets come from different contributors, so take one site's set from one contributor.",
  },
];

/** The register entry for a face, by the family name CSS sets. */
export function faceLicence(family: string): LicenceEntry | undefined {
  const name = family.trim().toLowerCase();
  return LICENCES.find((l) => l.subject === "face" && l.name.toLowerCase() === name);
}

export function licencesJson(): string {
  return JSON.stringify({ licences: LICENCES }, null, 2) + "\n";
}
