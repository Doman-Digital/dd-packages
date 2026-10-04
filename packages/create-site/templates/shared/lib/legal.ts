// The legal pages' facts, with every field present. A facts file written
// before the legal pages has no `legal` block; it reads as all unknown.
// Written by @domandigital/create-site.

import { facts } from "~site/facts";
import type { LegalFacts } from "~site/site-adapter";

export const legal: LegalFacts = {
  companyNumber: null,
  registeredOffice: null,
  icoNumber: null,
  privacyEmail: null,
  retention: null,
  processors: [],
  governingLaw: null,
  accessibilityIssues: [],
  reviewedOn: null,
  ...facts.legal,
};

/** Where a privacy request goes: the privacy address, else the main one. */
export const privacyEmail: string | null = legal.privacyEmail ?? facts.email;

/** "Acme Ltd, company number 01234567, registered office 1 High Street, Leeds" with what is known. */
export function identity(): string {
  const parts = [facts.legalName];
  if (legal.companyNumber) parts.push(`company number ${legal.companyNumber}`);
  if (legal.registeredOffice) parts.push(`registered office ${legal.registeredOffice}`);
  return parts.join(", ");
}

/** ICO's own page for complaints. A regulator's address, not the business's. */
export const ICO_COMPLAINTS = "https://ico.org.uk/make-a-complaint/";
