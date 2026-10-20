// The cookie policy, from dd-base (Doman-Digital/dd-library). The third
// parties are the processors in site.facts.ts that set cookies. Written by
// @domandigital/create-site.

import type { Metadata } from "next";
import { isRouteIndexable } from "@domandigital/seo";
import { CookieSettingsButton, CookieSettingsLink } from "~site/components/CookieBanner";
import { JsonLd } from "~site/components/JsonLd";
import { facts } from "~site/facts";
import { legal, privacyEmail } from "~site/legal";
import { buildPageGraph } from "~site/page-graph";
import { policy } from "~site/routes";

const TITLE = `Cookie policy: ${facts.tradingName}`;
const DESCRIPTION = `How ${facts.tradingName} uses cookies, and how to change your choice.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: isRouteIndexable(policy, "/cookies") },
};

const thirdParties = legal.processors.filter((p) => p.setsCookies);

export default function CookiesPage() {
  return (
    <main>
      <JsonLd graph={buildPageGraph({ path: "/cookies", name: TITLE, description: DESCRIPTION })} />
      <h1>Cookie policy</h1>
      {legal.reviewedOn && <p>Last reviewed {legal.reviewedOn}.</p>}

      <section>
        <h2>What cookies are</h2>
        <p>Cookies are small files a website stores in your browser, to make the site work or to learn how it is used.</p>
      </section>

      <section>
        <h2>What we use</h2>
        <p>
          <strong>Strictly necessary.</strong> Needed for the site to work, including the one that remembers your cookie
          choice. These do not need your consent.
        </p>
        <p>
          <strong>Visit statistics.</strong> On by default. We count visits with Cloudflare Web Analytics, which sets no
          cookies and stores nothing on your device. You can switch it off in <CookieSettingsLink />.
        </p>
        <p>
          <strong>Measurement.</strong> Off until you choose &quot;Accept measurement&quot;. They count visits and where
          they come from.
        </p>
        <dl>
          <dt>Name</dt>
          <dd>Cloudflare Web Analytics</dd>
          <dt>Purpose</dt>
          <dd>Visit statistics</dd>
          <dt>Storage</dt>
          <dd>None (no cookie or local storage)</dd>
          <dt>Default</dt>
          <dd>
            On. Switch off in <CookieSettingsLink />.
          </dd>
        </dl>
      </section>

      {thirdParties.length > 0 && (
        <section>
          <h2>Other companies&apos; cookies</h2>
          <ul>
            {thirdParties.map((p) => (
              <li key={p.name}>
                {p.name}: {p.purpose}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2>Changing your choice</h2>
        <p>You can change your choice at any time.</p>
        <CookieSettingsButton />
        {privacyEmail && (
          <p>
            Questions about cookies: <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a>.
          </p>
        )}
      </section>
    </main>
  );
}
