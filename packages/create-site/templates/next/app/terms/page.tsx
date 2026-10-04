// The website terms, from dd-base (Doman-Digital/dd-library). The governing
// law is a fact in site.facts.ts, not assumed: a Scottish business is under
// Scots law. Written by @domandigital/create-site.

import type { Metadata } from "next";
import { isRouteIndexable } from "@domandigital/seo";
import { JsonLd } from "~site/components/JsonLd";
import { facts } from "~site/facts";
import { identity, legal } from "~site/legal";
import { buildPageGraph } from "~site/page-graph";
import { policy } from "~site/routes";

const TITLE = `Website terms: ${facts.tradingName}`;
const DESCRIPTION = `The terms for using ${new URL(facts.url).hostname}.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: isRouteIndexable(policy, "/terms") },
};

export default function TermsPage() {
  return (
    <main>
      <JsonLd graph={buildPageGraph({ path: "/terms", name: TITLE, description: DESCRIPTION })} />
      <h1>Website terms</h1>
      {legal.reviewedOn && <p>Last reviewed {legal.reviewedOn}.</p>}

      <section>
        <h2>About these terms</h2>
        <p>
          These terms cover your use of {new URL(facts.url).hostname}, run by {identity()}. By using the site you accept
          them.
        </p>
      </section>

      <section>
        <h2>Using the site</h2>
        <p>
          Use the site lawfully. Do not try to break into it, slow it down or spread anything harmful through it.
        </p>
      </section>

      <section>
        <h2>Who owns the content</h2>
        <p>
          The content belongs to {facts.legalName} or is used with permission. You may view it and save a copy for your
          own use. Ask us before publishing it anywhere else.
        </p>
      </section>

      <section>
        <h2>Availability and accuracy</h2>
        <p>
          We work to keep the site available and correct, but cannot promise it always will be. The information here is
          general and is not professional advice for your situation.
        </p>
      </section>

      <section>
        <h2>Liability</h2>
        <p>
          Nothing in these terms limits our liability for death or personal injury caused by our negligence, for fraud, or
          for anything else the law does not allow us to limit. Otherwise we are not liable for indirect or consequential
          loss from using the site.
        </p>
      </section>

      {legal.governingLaw && (
        <section>
          <h2>The law that applies</h2>
          <p>
            These terms are governed by the law of {legal.governingLaw}, and its courts deal with any dispute about them.
          </p>
        </section>
      )}
    </main>
  );
}
