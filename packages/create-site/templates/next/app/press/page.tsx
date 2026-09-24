// The press page: company facts, checked accreditations, press contact and
// earned coverage, all read from the site's data files. A section with no
// data is not rendered, so nothing is invented. Written by
// @domandigital/create-site.

import type { Metadata } from "next";
import { isRouteIndexable } from "@domandigital/seo";
import type { BacklinkRegister } from "@domandigital/seo";
import { JsonLd } from "~site/components/JsonLd";
import { facts } from "~site/facts";
import links from "~site/links.json";
import { buildPageGraph } from "~site/page-graph";
import { policy } from "~site/routes";

const TITLE = `Press: ${facts.tradingName}`;

export const metadata: Metadata = {
  title: TITLE,
  description: facts.description,
  robots: { index: isRouteIndexable(policy, "/press") },
};

const accreditations = facts.accreditations.filter((a) => a.registerUrl && a.verifiedOn);
const coverage = (links as BacklinkRegister).links.filter((l) => l.kind === "press" && l.status === "live");

export default function PressPage() {
  return (
    <main>
      <JsonLd graph={buildPageGraph({ path: "/press", name: TITLE, description: facts.description })} />
      <h1>Press</h1>

      <section>
        <h2>About {facts.tradingName}</h2>
        <p>{facts.description}</p>
      </section>

      <section>
        <h2>Company facts</h2>
        <dl>
          <dt>Registered name</dt>
          <dd>{facts.legalName}</dd>
          {facts.serviceAreas.length > 0 && (
            <>
              <dt>Areas served</dt>
              <dd>{facts.serviceAreas.join(", ")}</dd>
            </>
          )}
          <dt>Website</dt>
          <dd>{facts.url}</dd>
        </dl>
      </section>

      {accreditations.length > 0 && (
        <section>
          <h2>Accreditations</h2>
          <ul>
            {accreditations.map((a) => (
              <li key={a.name}>
                <a href={a.registerUrl ?? undefined}>{a.name}</a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(facts.email || facts.phone) && (
        <section>
          <h2>Press contact</h2>
          {facts.email && (
            <p>
              <a href={`mailto:${facts.email}`}>{facts.email}</a>
            </p>
          )}
          {facts.phone && (
            <p>
              <a href={`tel:${facts.phone.replace(/\s+/g, "")}`}>{facts.phone}</a>
            </p>
          )}
        </section>
      )}

      {coverage.length > 0 && (
        <section>
          <h2>Coverage</h2>
          <ul>
            {coverage.map((c) => (
              <li key={c.url}>
                <a href={c.url}>{c.source}</a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
