import { describe, expect, it } from "vitest";
import { INGEST_HOST, normaliseDsn, resolveDsn, resolveEnvironment, resolveRelease } from "../index";

describe("resolveEnvironment", () => {
  it("reads the first variable set, in order", () => {
    expect(resolveEnvironment({ env: { SENTRY_ENVIRONMENT: "staging", PUBLIC_SENTRY_ENVIRONMENT: "production" } })).toEqual({
      environment: "staging",
      enabled: true,
      from: "SENTRY_ENVIRONMENT",
    });
    expect(resolveEnvironment({ env: { PUBLIC_SENTRY_ENVIRONMENT: "production" } }).environment).toBe("production");
    expect(resolveEnvironment({ env: { NEXT_PUBLIC_SENTRY_ENVIRONMENT: "preview" } }).environment).toBe("preview");
    expect(resolveEnvironment({ env: { VERCEL_ENV: "production" } }).environment).toBe("production");
  });

  it("lets an explicit value win and skips blanks", () => {
    expect(resolveEnvironment({ environment: "staging", env: { SENTRY_ENVIRONMENT: "production" } })).toMatchObject({ environment: "staging", from: "explicit" });
    expect(resolveEnvironment({ environment: "  ", env: { SENTRY_ENVIRONMENT: " production " } }).environment).toBe("production");
  });

  it("keeps to production, staging and preview", () => {
    expect(resolveEnvironment({ environment: "PROD" }).environment).toBe("production");
    expect(resolveEnvironment({ environment: "stg" }).environment).toBe("staging");
    expect(resolveEnvironment({ environment: "qa-branch-7" }).environment).toBe("preview");
  });

  it("falls back to preview when nothing is set, never to production", () => {
    expect(resolveEnvironment({})).toEqual({ environment: "preview", enabled: true, from: null });
    expect(resolveEnvironment({ env: { NODE_ENV: "production" } }).environment).toBe("preview");
  });

  it("turns reporting off on a developer's machine", () => {
    for (const value of ["development", "dev", "local", "test"]) {
      expect(resolveEnvironment({ environment: value })).toMatchObject({ environment: "preview", enabled: false });
    }
    expect(resolveEnvironment({ env: { VERCEL_ENV: "development" } }).enabled).toBe(false);
  });
});

describe("resolveRelease", () => {
  it("takes the SHA from whichever CI built it", () => {
    expect(resolveRelease({ env: { GITHUB_SHA: "abc" } })).toBe("abc");
    expect(resolveRelease({ env: { CF_PAGES_COMMIT_SHA: "cf", GITHUB_SHA: "gh" } })).toBe("cf");
    expect(resolveRelease({ env: { SENTRY_RELEASE: "pinned", VERCEL_GIT_COMMIT_SHA: "v" } })).toBe("pinned");
    expect(resolveRelease({ release: "x", env: { SENTRY_RELEASE: "y" } })).toBe("x");
    expect(resolveRelease({ env: {} })).toBeUndefined();
    expect(resolveRelease({ env: { SENTRY_RELEASE: "" } })).toBeUndefined();
  });

  it("ignores Worker bindings that are not strings", () => {
    expect(resolveRelease({ env: { SENTRY_RELEASE: { id: 1 }, GITHUB_SHA: "abc" } })).toBe("abc");
  });
});

describe("normaliseDsn", () => {
  it("moves a pre-transfer org host to the org's own", () => {
    expect(normaliseDsn("https://k3y@o4511782767689728.ingest.de.sentry.io/4511824127656016")).toBe(
      `https://k3y@${INGEST_HOST}/4511824127656016`,
    );
  });

  it("leaves the current host, other hosts and junk alone", () => {
    const current = `https://k3y@${INGEST_HOST}/1`;
    expect(normaliseDsn(current)).toBe(current);
    expect(normaliseDsn("https://k3y@o1.ingest.us.sentry.io/1")).toBe("https://k3y@o1.ingest.us.sentry.io/1");
    expect(normaliseDsn("not a dsn")).toBe("not a dsn");
    expect(normaliseDsn("")).toBeUndefined();
    expect(normaliseDsn(undefined)).toBeUndefined();
  });

  it("is what resolveDsn returns, from the input or the variables", () => {
    expect(resolveDsn({ env: { PUBLIC_SENTRY_DSN: "https://k@o9.ingest.de.sentry.io/2" } })).toBe(`https://k@${INGEST_HOST}/2`);
    expect(resolveDsn({ dsn: "https://a@o9.ingest.de.sentry.io/3", env: { SENTRY_DSN: "https://b@x/4" } })).toBe(`https://a@${INGEST_HOST}/3`);
  });
});
