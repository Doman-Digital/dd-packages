import { memoryReplayGuard, sign, type SignOptions, type SyntheticKey, type VerifyConfig } from "../index";
import { toBase64Url } from "../encoding";

export const NOW = 1_790_000_000;

function secretOf(fill: number): string {
  return toBase64Url(new Uint8Array(32).fill(fill));
}

export const KEY_A: SyntheticKey = { kid: "example-2026-10", secret: secretOf(1) };
export const KEY_B: SyntheticKey = { kid: "example-2026-11", secret: secretOf(2) };

export const URL_OK = "https://www.example.co.uk/api/enquiry";
export const BODY = '{"name":"DD Synthetic Check","email":"s-abcdefghijklmnop@canary.domandigital.co.uk"}';

export function config(overrides: Partial<VerifyConfig> = {}): VerifyConfig {
  return {
    keys: [KEY_A],
    host: "www.example.co.uk",
    path: "/api/enquiry",
    contentTypes: ["application/json"],
    replayGuard: memoryReplayGuard(),
    now: NOW,
    ...overrides,
  };
}

/** Signs a request and returns everything `verify` needs, with optional tampering. */
export async function signed(overrides: Partial<SignOptions> = {}, tamper: {
  headers?: Record<string, string>;
  body?: string;
  method?: string;
  url?: string;
  dropHeader?: string;
  contentType?: string;
} = {}) {
  const options: SignOptions = {
    key: KEY_A,
    url: URL_OK,
    contentType: "application/json",
    body: BODY,
    client: "example",
    form: "enquiry",
    mode: "probe",
    now: NOW,
    ...overrides,
  };
  const { headers, runId } = await sign(options);
  const all = new Headers({ "content-type": tamper.contentType ?? options.contentType, ...headers, ...tamper.headers });
  if (tamper.dropHeader) all.delete(tamper.dropHeader);
  return {
    runId,
    input: {
      method: tamper.method ?? "POST",
      url: tamper.url ?? URL_OK,
      headers: all,
      body: tamper.body ?? BODY,
    },
  };
}
