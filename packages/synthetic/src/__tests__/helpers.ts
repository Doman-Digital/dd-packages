import { sign, type SignInput, type SynthKey, type VerifyConfig } from "../index";
import vectors from "../../test-vectors.json";

export const KEY_A: SynthKey = { kid: "test-2026-10", secret: vectors.secretBase64Url };
// A second, different 32-byte secret: bytes 0x20..0x3f.
export const KEY_B: SynthKey = {
  kid: "test-2026-10-next",
  secret: btoa(String.fromCharCode(...Array.from({ length: 32 }, (_, i) => i + 32)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, ""),
};

export const NOW = 1_790_000_000;
export const URL_OK = "https://staging.sensphere.co.uk/api/contact";
export const BODY = '{"name":"DD Synthetic Check","email":"s-abcdefghijklmnop@canary.domandigital.co.uk"}';

export function memoryGuard() {
  const seen = new Set<string>();
  const guard = async (runId: string) => {
    if (seen.has(runId)) return false;
    seen.add(runId);
    return true;
  };
  return { guard, seen };
}

export function config(over: Partial<VerifyConfig> = {}): VerifyConfig {
  return {
    keys: [KEY_A],
    host: "staging.sensphere.co.uk",
    paths: "/api/contact",
    contentTypes: ["application/json"],
    replayGuard: memoryGuard().guard,
    now: () => NOW,
    ...over,
  };
}

export async function signedRequest(over: Partial<SignInput> = {}, body = BODY) {
  const s = await sign({
    key: KEY_A,
    mode: "full",
    client: "sensphere",
    form: "contact",
    url: URL_OK,
    contentType: "application/json",
    body,
    ts: NOW,
    ...over,
  });
  return {
    signed: s,
    input: {
      method: "POST",
      url: URL_OK,
      headers: { "content-type": "application/json", ...s.headers },
      body,
    },
  };
}
