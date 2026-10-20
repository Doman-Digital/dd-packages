"use client";

// Cloudflare Web Analytics for every visitor, from the first page, unless they
// have switched Visit statistics off in the cookie settings. Not behind the
// banner's buttons. Put <WebAnalytics /> once in the root layout; launch:check
// fails until it is placed and the site's token is in site.facts.ts. Written by
// @domandigital/create-site. Rule: docs/web-analytics.md in claude-kit.

import { useEffect } from "react";
import { facts } from "~site/facts";
import { startWebAnalytics } from "~site/web-analytics";

export function WebAnalytics() {
  useEffect(() => startWebAnalytics(facts.webAnalytics?.token, { spa: true }), []);
  return null;
}
