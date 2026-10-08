export const H = {
  marker: "X-DD-Synth",
  kid: "X-DD-Synth-Kid",
  ts: "X-DD-Synth-Ts",
  run: "X-DD-Synth-Run",
  mode: "X-DD-Synth-Mode",
  client: "X-DD-Synth-Client",
  form: "X-DD-Synth-Form",
  sig: "X-DD-Synth-Sig",
} as const;

export type HeaderBag = Headers | Record<string, string | string[] | undefined>;

/** Case-insensitive single-value read from a Headers or a plain object. */
export function readHeader(headers: HeaderBag, name: string): string | undefined {
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name) ?? undefined;
  }
  const lower = name.toLowerCase();
  for (const [k, v] of Object.entries(headers as Record<string, string | string[] | undefined>)) {
    if (k.toLowerCase() === lower) return Array.isArray(v) ? v[0] : v;
  }
  return undefined;
}
