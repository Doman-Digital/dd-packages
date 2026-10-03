"use client";

// The cookie banner, and the button that brings it back. Written by
// @domandigital/create-site, from the dd-base banner (Doman-Digital/dd-library).
// Unstyled: style it with the site's own classes. Put <CookieBanner /> once
// in the root layout; launch:check fails until it is placed.
//
// It renders nothing on the server and nothing once a choice is stored, so a
// returning visitor never sees it flash. The two buttons carry equal weight:
// refusing must be as easy as accepting.

import { useEffect, useState } from "react";
import { SETTINGS_EVENT, getConsent, openCookieSettings, setConsent } from "~site/consent";

export function CookieBanner({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(getConsent() === null);
    const reopen = () => setOpen(true);
    window.addEventListener(SETTINGS_EVENT, reopen);
    return () => window.removeEventListener(SETTINGS_EVENT, reopen);
  }, []);

  if (!open) return null;

  const decide = (measurement: boolean) => {
    setConsent(measurement);
    setOpen(false);
  };

  return (
    <div className={className} role="region" aria-label="Cookie choices">
      <p>
        We use cookies the site needs to work. With your permission we also use measurement cookies to see how the site is
        used. <a href="/cookies">Cookie policy</a>
      </p>
      <button type="button" onClick={() => decide(false)}>
        Necessary only
      </button>
      <button type="button" onClick={() => decide(true)}>
        Accept measurement
      </button>
    </div>
  );
}

/** Shows the banner again, so a visitor can change their choice. */
export function CookieSettingsButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className} onClick={openCookieSettings}>
      Change cookie settings
    </button>
  );
}
