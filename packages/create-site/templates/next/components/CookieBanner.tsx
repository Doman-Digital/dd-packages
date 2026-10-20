"use client";

// The cookie banner, its settings, and the links that open them. Written by
// @domandigital/create-site, from the dd-base banner (Doman-Digital/dd-library).
// Unstyled: style it with the site's own classes. Put <CookieBanner /> once
// in the root layout; launch:check fails until it is placed.
//
// It renders nothing on the server and nothing once a choice is stored, so a
// returning visitor never sees it flash. Necessary only and Accept
// measurement carry equal weight: refusing must be as easy as accepting. They
// answer the consent-based tools only. Visit statistics (Cloudflare Web
// Analytics) is a separate switch in Settings, on until the visitor switches
// it off, and neither button changes it. The settings open from the banner,
// from <CookieSettingsLink /> and <CookieSettingsButton />, and from the
// #cookie-settings address. Rule: docs/web-analytics.md in claude-kit.

import { useEffect, useState } from "react";
import { SETTINGS_EVENT, getConsent, getStatistics, openCookieSettings, setConsent } from "~site/consent";

const SETTINGS_HASH = "#cookie-settings";

type View = "closed" | "banner" | "settings";

export function CookieBanner({ className }: { className?: string }) {
  const [view, setView] = useState<View>("closed");
  const [measurement, setMeasurement] = useState(false);
  const [statistics, setStatistics] = useState(true);

  const openSettings = () => {
    setMeasurement(getConsent()?.measurement ?? false);
    setStatistics(getStatistics());
    setView("settings");
  };

  useEffect(() => {
    const fromAddress = () => {
      if (window.location.hash === SETTINGS_HASH) openSettings();
    };
    if (window.location.hash === SETTINGS_HASH) openSettings();
    else setView(getConsent() === null ? "banner" : "closed");
    window.addEventListener(SETTINGS_EVENT, openSettings);
    window.addEventListener("hashchange", fromAddress);
    return () => {
      window.removeEventListener(SETTINGS_EVENT, openSettings);
      window.removeEventListener("hashchange", fromAddress);
    };
  }, []);

  if (view === "closed") return null;

  const decide = (accept: boolean) => {
    setConsent(accept);
    setView("closed");
  };

  if (view === "banner") {
    return (
      <div className={className} role="region" aria-label="Cookie choices">
        <p>
          We use cookies the site needs to work. With your permission we also use measurement cookies to see how the site is
          used. Visit statistics run without cookies and you can switch them off in settings. <a href="/cookies">Cookie policy</a>
        </p>
        <button type="button" onClick={openSettings}>
          Settings
        </button>
        <button type="button" onClick={() => decide(false)}>
          Necessary only
        </button>
        <button type="button" onClick={() => decide(true)}>
          Accept measurement
        </button>
      </div>
    );
  }

  return (
    <div className={className} role="region" aria-label="Cookie settings">
      <h2>Cookie settings</h2>
      <p>Strictly necessary cookies are always on. They keep the site working and remember these choices.</p>
      <label>
        <input type="checkbox" role="switch" checked={statistics} onChange={(e) => setStatistics(e.target.checked)} />
        Visit statistics
      </label>
      <p>Counts visits without cookies, to show which pages people use and how fast they load. Used only to improve the site. On unless you switch it off.</p>
      <label>
        <input type="checkbox" role="switch" checked={measurement} onChange={(e) => setMeasurement(e.target.checked)} />
        Measurement cookies
      </label>
      <p>Optional cookies that show us in more detail how the site is used. Off unless you switch them on.</p>
      <button type="button" onClick={() => setView(getConsent() === null ? "banner" : "closed")}>
        Cancel
      </button>
      <button
        type="button"
        onClick={() => {
          setConsent(measurement, statistics);
          setView("closed");
        }}
      >
        Save choices
      </button>
    </div>
  );
}

/** A link to the cookie settings, for the privacy notice and the footer. */
export function CookieSettingsLink({ className, children = "cookie settings" }: { className?: string; children?: React.ReactNode }) {
  return (
    <a
      href={SETTINGS_HASH}
      className={className}
      onClick={(event) => {
        event.preventDefault();
        openCookieSettings();
      }}
    >
      {children}
    </a>
  );
}

/** Opens the settings, so a visitor can change their choice. */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={openCookieSettings}>
      Change cookie settings
    </button>
  );
}
