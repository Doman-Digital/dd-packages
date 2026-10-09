#!/usr/bin/env node
/**
 * Regenerates test-vectors.json with node:crypto, deliberately not with the
 * package's own code, so the vectors are an independent second implementation
 * of the protocol. The secret here is a published test value; it protects
 * nothing.
 */
import { createHash, createHmac } from "node:crypto";
import { writeFileSync } from "node:fs";

const secretBytes = Buffer.from(Array.from({ length: 32 }, (_, i) => i));

const cases = [
  {
    name: "json-probe",
    kid: "example-2026-10",
    ts: 1790000000,
    runId: "abcdefghijklmnop",
    mode: "probe",
    client: "example",
    form: "enquiry",
    url: "https://www.example.co.uk/api/enquiry",
    contentType: "application/json",
    body: '{"name":"DD Synthetic Check","email":"s-abcdefghijklmnop@canary.domandigital.co.uk"}',
  },
  {
    name: "form-urlencoded-full-with-port-and-query",
    kid: "example-2026-10",
    ts: 1790000060,
    runId: "765432abcdefghij",
    mode: "full",
    client: "example",
    form: "newsletter",
    url: "https://staging.example.co.uk:8443/forms/newsletter?utm=1",
    contentType: "application/x-www-form-urlencoded",
    body: "email=u-765432abcdefghij%40canary.domandigital.co.uk",
  },
  {
    name: "empty-body",
    kid: "example-2026-10",
    ts: 1790000120,
    runId: "aaaaaaaaaaaaaaaa",
    mode: "probe",
    client: "example",
    form: "enquiry",
    url: "https://www.example.co.uk/api/enquiry",
    contentType: "application/json",
    body: "",
  },
];

const vectors = cases.map((c) => {
  const u = new URL(c.url);
  const bodySha256 = createHash("sha256").update(c.body).digest("hex");
  const canonical = [
    "DD-SYNTH-V1", c.kid, String(c.ts), c.runId, c.mode, c.client, c.form,
    "POST", u.host.toLowerCase(), u.pathname, c.contentType, bodySha256,
  ].join("\n");
  const signature = createHmac("sha256", secretBytes).update(canonical).digest("hex");
  return { ...c, host: u.host.toLowerCase(), path: u.pathname, bodySha256, canonical, signature: `v1=${signature}` };
});

writeFileSync(
  new URL("../test-vectors.json", import.meta.url),
  JSON.stringify(
    {
      note: "Published test vectors for @domandigital/synthetic protocol v1. The secret is a test value (bytes 0..31).",
      secret: secretBytes.toString("base64url"),
      vectors,
    },
    null,
    2,
  ) + "\n",
);
