import { describe, expect, it } from "vitest";
import { captureGlobalError, nextBuildOptions, onRequestError, thirdPartyFilterOptions } from "../next";
import { calls } from "./fixtures/sentry-nextjs";

describe("nextBuildOptions", () => {
  it("names the org, the commit as the release and a deploy to the environment", () => {
    expect(
      nextBuildOptions({
        project: "harrisons-beauty",
        env: { SENTRY_AUTH_TOKEN: "sntrys_x", VERCEL_GIT_COMMIT_SHA: "abc", VERCEL_ENV: "production", CI: "1" },
      }),
    ).toEqual({
      org: "domandigital",
      project: "harrisons-beauty",
      authToken: "sntrys_x",
      applicationKey: "dd-harrisons-beauty",
      silent: false,
      widenClientFileUpload: true,
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      release: { name: "abc", deploy: { env: "production" } },
    });
  });

  it("leaves the release to the plugin when there is no SHA, and records no deploy from a laptop", () => {
    const bare = nextBuildOptions({ project: "p", env: {} });
    expect("release" in bare).toBe(false);
    expect("authToken" in bare).toBe(false);
    expect(bare.silent).toBe(true);
    expect(nextBuildOptions({ project: "p", env: { GITHUB_SHA: "s", SENTRY_ENVIRONMENT: "development" } }).release).toEqual({ name: "s" });
  });

  it("matches the third-party filter to the same key", () => {
    expect(thirdPartyFilterOptions("harrisons-beauty")).toEqual({
      filterKeys: ["dd-harrisons-beauty"],
      behaviour: "drop-error-if-exclusively-contains-third-party-frames",
    });
  });
});

describe("capture hooks", () => {
  it("hands request errors to the site's @sentry/nextjs", async () => {
    const err = new Error("render failed");
    const request = { path: "/book", method: "GET", headers: {} };
    const context = { routerKind: "App Router", routePath: "/book", routeType: "render" };
    await onRequestError(err, request, context);
    expect(calls.at(-1)).toEqual({ fn: "captureRequestError", args: [err, request, context] });
  });

  it("tags global-error captures and keeps the digest", async () => {
    const err = Object.assign(new Error("root layout threw"), { digest: "123" });
    await captureGlobalError(err);
    expect(calls.at(-1)).toEqual({ fn: "captureException", args: [err, { tags: { boundary: "global-error" }, extra: { digest: "123" } }] });
  });
});
