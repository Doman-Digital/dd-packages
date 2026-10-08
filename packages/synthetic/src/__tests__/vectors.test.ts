import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalString, sign, verify, verifyReport } from "../index";
import vectors from "../../test-vectors.json";
import { memoryGuard } from "./helpers";

const secret = vectors.secretBase64Url;

describe("published test vectors (test-vectors.json)", () => {
  for (const v of vectors.requests) {
    describe(v.name, () => {
      it("canonical string matches the spec layout", () => {
        const expected = ["DD-SYNTH-V1", v.kid, v.ts, v.runId, v.mode, v.client, v.form, "POST", v.host, v.path, v.contentType, v.bodySha256].join("\n");
        expect(v.canonical).toBe(expected);
        expect(canonicalString({ ...v, mode: v.mode as "probe" | "full" })).toBe(v.canonical);
      });

      it("matches an independent node:crypto implementation", () => {
        expect(createHash("sha256").update(v.body).digest("hex")).toBe(v.bodySha256);
        const mac = createHmac("sha256", Buffer.from(secret, "base64url")).update(v.canonical).digest("hex");
        expect(mac).toBe(v.signature);
      });

      it("sign() reproduces the vector signature and header", async () => {
        const s = await sign({
          key: { kid: v.kid, secret },
          mode: v.mode as "probe" | "full",
          client: v.client,
          form: v.form,
          url: `https://${v.host}${v.path}`,
          contentType: v.contentType,
          body: v.body,
          runId: v.runId,
          ts: v.ts,
        });
        expect(s.canonical).toBe(v.canonical);
        expect(s.signature).toBe(v.signature);
        expect(s.headers["X-DD-Synth-Sig"]).toBe(v.header);
        expect(s.headers["X-DD-Synth"]).toBe("v1");
      });

      it("verify() accepts the vector as published", async () => {
        const res = await verify(
          {
            method: "POST",
            url: `https://${v.host}${v.path}`,
            body: v.body,
            headers: {
              "content-type": v.contentType,
              "x-dd-synth": "v1",
              "x-dd-synth-kid": v.kid,
              "x-dd-synth-ts": String(v.ts),
              "x-dd-synth-run": v.runId,
              "x-dd-synth-mode": v.mode,
              "x-dd-synth-client": v.client,
              "x-dd-synth-form": v.form,
              "x-dd-synth-sig": v.header,
            },
          },
          {
            keys: [{ kid: v.kid, secret }],
            host: v.host,
            paths: v.path,
            contentTypes: [v.contentType.split(";")[0]],
            replayGuard: memoryGuard().guard,
            now: () => v.ts,
          },
        );
        expect(res.ok).toBe(true);
      });
    });
  }

  it("report vectors verify with verifyReport and match node:crypto", async () => {
    for (const r of vectors.reports) {
      const mac = createHmac("sha256", Buffer.from(secret, "base64url")).update(r.canonical).digest("hex");
      expect(mac).toBe(r.signature);
      const res = await verifyReport(
        { "x-dd-synth": "report-v1", "x-dd-synth-kid": r.kid, "x-dd-synth-ts": String(r.ts), "x-dd-synth-sig": r.header },
        r.body,
        [{ kid: r.kid, secret }],
        { now: () => r.ts },
      );
      expect(res.ok).toBe(true);
    }
  });
});
