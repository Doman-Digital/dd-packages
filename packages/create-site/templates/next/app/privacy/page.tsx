// The privacy policy, from the UK GDPR baseline in dd-base
// (Doman-Digital/dd-library), reading every fact from site.facts.ts. A fact
// that is null is left out, never filled with a placeholder; launch:check
// fails until the ones every site needs are set. Have the client confirm it
// matches what the business does before launch. Written by
// @domandigital/create-site.

import type { Metadata } from "next";
import { isRouteIndexable } from "@domandigital/seo";
import { JsonLd } from "~site/components/JsonLd";
import { facts } from "~site/facts";
import { ICO_COMPLAINTS, identity, legal, privacyEmail } from "~site/legal";
import { buildPageGraph } from "~site/page-graph";
import { policy } from "~site/routes";

const TITLE = `Privacy policy: ${facts.tradingName}`;
const DESCRIPTION = `How ${facts.tradingName} collects, uses and protects personal data under the UK GDPR.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: isRouteIndexable(policy, "/privacy") },
};

export default function PrivacyPage() {
  return (
    <main>
      <JsonLd graph={buildPageGraph({ path: "/privacy", name: TITLE, description: DESCRIPTION })} />
      <h1>Privacy policy</h1>
      {legal.reviewedOn && <p>Last reviewed {legal.reviewedOn}.</p>}

      <section>
        <h2>Who we are</h2>
        <p>{identity()} is responsible for the personal data collected through this website.</p>
        {legal.icoNumber && <p>We are registered with the Information Commissioner&apos;s Office, number {legal.icoNumber}.</p>}
      </section>

      <section>
        <h2>What we collect</h2>
        <p>
          When you contact us we keep what you send: your name, how to reach you and your message. When you use the site,
          the server records technical details such as your IP address and browser to keep it running and secure. With
          your permission, and only then, we also measure how the site is used.
        </p>
      </section>

      <section>
        <h2>Why we are allowed to</h2>
        <ul>
          <li>Answering you and doing the work you ask for: taking steps towards a contract, or a contract, Article 6(1)(b).</li>
          <li>Measurement cookies: your consent, Article 6(1)(a). They are off until you accept them.</li>
          <li>Keeping the site running and secure: our legitimate interests, Article 6(1)(f).</li>
        </ul>
      </section>

      {legal.processors.length > 0 && (
        <section>
          <h2>Who we share it with</h2>
          <p>These companies handle personal data for us, under written contracts:</p>
          <ul>
            {legal.processors.map((p) => (
              <li key={p.name}>
                {p.name}: {p.purpose}
              </li>
            ))}
          </ul>
          <p>We do not sell personal data.</p>
        </section>
      )}

      {legal.retention && (
        <section>
          <h2>How long we keep it</h2>
          <p>{legal.retention}</p>
        </section>
      )}

      <section>
        <h2>Your rights</h2>
        <p>
          You can ask to see, correct, delete or move your personal data, ask us to stop or limit using it, and object to
          how we use it. Where we rely on your consent you can withdraw it at any time.
          {privacyEmail && (
            <>
              {" "}Write to <a href={`mailto:${privacyEmail}`}>{privacyEmail}</a>.
            </>
          )}
        </p>
        <p>
          If you are unhappy with our answer you can complain to the Information Commissioner&apos;s Office:{" "}
          <a href={ICO_COMPLAINTS}>ico.org.uk/make-a-complaint</a>.
        </p>
      </section>
    </main>
  );
}
