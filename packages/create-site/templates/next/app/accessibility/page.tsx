// The accessibility statement, from dd-base (Doman-Digital/dd-library). It
// states the standard the house builds to and the problems someone has
// actually found; it claims nothing it has not checked. Written by
// @domandigital/create-site.

import type { Metadata } from "next";
import { isRouteIndexable } from "@domandigital/seo";
import { JsonLd } from "~site/components/JsonLd";
import { facts } from "~site/facts";
import { legal } from "~site/legal";
import { buildPageGraph } from "~site/page-graph";
import { policy } from "~site/routes";

const TITLE = `Accessibility: ${facts.tradingName}`;
const DESCRIPTION = `How ${facts.tradingName} makes this website usable by everyone, and how to tell us when it is not.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: isRouteIndexable(policy, "/accessibility") },
};

export default function AccessibilityPage() {
  return (
    <main>
      <JsonLd graph={buildPageGraph({ path: "/accessibility", name: TITLE, description: DESCRIPTION })} />
      <h1>Accessibility</h1>
      {legal.reviewedOn && <p>Last reviewed {legal.reviewedOn}.</p>}

      <section>
        <h2>The standard we build to</h2>
        <p>We aim for this site to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA. That means:</p>
        <ul>
          <li>text has enough contrast against its background</li>
          <li>everything works with a keyboard</li>
          <li>images that carry meaning have a text alternative</li>
          <li>movement stops when your device asks for reduced motion</li>
          <li>headings follow the order of the page</li>
          <li>form fields have visible labels and clear error messages</li>
        </ul>
      </section>

      {legal.accessibilityIssues.length > 0 && (
        <section>
          <h2>Problems we know about</h2>
          <ul>
            {legal.accessibilityIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </section>
      )}

      {facts.email && (
        <section>
          <h2>Tell us about a problem</h2>
          <p>
            If something on the site does not work for you, email <a href={`mailto:${facts.email}`}>{facts.email}</a> and
            we will put it right.
          </p>
        </section>
      )}
    </main>
  );
}
