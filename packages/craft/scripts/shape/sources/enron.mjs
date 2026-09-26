// Human baseline, business email: the Enron corpus (CMU release, public via FERC).
//
//   node scripts/shape/sources/enron.mjs --tarball <path to enron_mail_20150507.tar.gz>
//
// Streams the tarball through gunzip into a 512-byte-block tar reader, so memory
// stays flat and no dependency is needed. Only sent folders are read, so the
// text is the writer's own. Headers, quoted replies, forwards, signatures and
// disclaimers are cut; messages dated 2003 or later are dropped. Nothing but
// feature vectors is written, and the tarball stays outside the repo.

import { createReadStream, existsSync } from "node:fs";
import { createGunzip } from "node:zlib";
import { Baseline, flag, memory, paragraphs } from "../lib.mjs";

const tarball = flag("tarball");
if (!tarball || !existsSync(tarball)) {
  console.error("usage: node scripts/shape/sources/enron.mjs --tarball <enron_mail_20150507.tar.gz> [--force]");
  process.exit(2);
}

const SENT = /^maildir\/([^/]+)\/(?:sent|sent_items|_sent_mail)\/[^/]+$/;

/** The writer's own words from one message, or null. */
export function body(raw) {
  const split = raw.search(/\r?\n\r?\n/);
  if (split === -1) return null;
  const headers = raw.slice(0, split);
  const date = headers.match(/^Date:\s*(.+)$/m);
  const year = date ? new Date(date[1]).getUTCFullYear() : NaN;
  if (!Number.isFinite(year) || year >= 2003 || year < 1997) return null;
  let text = raw.slice(split).replace(/\r\n?/g, "\n");
  // Everything after the first quoted or forwarded block is someone else's.
  const cut = text.search(/^(?:\s*-{2,}\s*Original Message\s*-{2,}|\s*-{2,}\s*Forwarded by|\s*From:\s|\s*To:\s|\s*-{5,}|.*\bwrote:\s*$|\s*_{5,}|\s*\*{5,})/im);
  if (cut !== -1) text = text.slice(0, cut);
  const lines = text
    .split("\n")
    .filter((l) => !/^\s*>/.test(l))
    // A signature or sign-off line on its own: a name, a phone number, an address.
    .filter((l) => !/^\s*(?:--\s*$|thanks[,!.]?\s*$|regards|best|cheers|[A-Z][a-z]+\s*$|\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4})/i.test(l));
  return lines.join("\n").trim() || null;
}

const out = new Baseline({
  source: "enron",
  register: "business-email",
  licence: "Public record, released by FERC; CMU distribution (enron_mail_20150507)",
  note: "Sent folders only (sent, sent_items, _sent_mail), dated 1997 to 2002. Quoted replies, forwards and signatures cut. Writer = mailbox owner.",
});

let pending = Buffer.alloc(0);
let entry = null; // { name, size, remaining, chunks }
let longName = null;
let files = 0;
let kept = 0;

function readHeader(block) {
  if (block.every((b) => b === 0)) return null;
  const str = (a, b) => block.subarray(a, b).toString("utf8").replace(/\0.*$/s, "");
  const size = parseInt(str(124, 136).trim() || "0", 8);
  const type = String.fromCharCode(block[156] || 48);
  const prefix = str(345, 500);
  const name = longName ?? (prefix ? `${prefix}/${str(0, 100)}` : str(0, 100));
  longName = null;
  return { name, size, type };
}

function finish(e) {
  if (e.type === "L") {
    longName = Buffer.concat(e.chunks).toString("utf8").replace(/\0.*$/s, "");
    return;
  }
  const m = e.name.match(SENT);
  if (!m || e.type !== "0") return;
  files += 1;
  const text = body(Buffer.concat(e.chunks).toString("latin1"));
  if (!text) return;
  kept += 1;
  for (const p of paragraphs(text)) out.add(p, m[1]);
  if (files % 20000 === 0) console.error(`  ${files} sent messages read, ${kept} kept, ${out.counts.blurbs} blurbs, ${memory()}`);
}

function consume(chunk) {
  pending = pending.length ? Buffer.concat([pending, chunk]) : chunk;
  for (;;) {
    if (entry) {
      // `remaining` counts the padding to the next 512-byte boundary; only `size` bytes are content.
      const take = Math.min(entry.remaining, pending.length);
      const content = Math.max(0, Math.min(take, entry.remaining - entry.padding));
      if (content > 0 && entry.wanted) entry.chunks.push(pending.subarray(0, content));
      pending = pending.subarray(take);
      entry.remaining -= take;
      if (entry.remaining > 0) return;
      finish(entry);
      entry = null;
    }
    if (pending.length < 512) return;
    const header = readHeader(pending.subarray(0, 512));
    pending = pending.subarray(512);
    if (!header) continue;
    const padding = Math.ceil(header.size / 512) * 512 - header.size;
    entry = { ...header, padding, remaining: header.size + padding, chunks: [], wanted: header.type === "L" || SENT.test(header.name) };
  }
}

const started = Date.now();
createReadStream(tarball)
  .pipe(createGunzip())
  .on("data", consume)
  .on("error", (e) => {
    console.error(`enron: ${e.message}`);
    process.exit(1);
  })
  .on("end", () => {
    const result = out.write("enron-v1.json", { force: Boolean(flag("force", false)) });
    console.error(`enron: ${files} sent messages, ${kept} kept, peak ${memory()}, ${Math.round((Date.now() - started) / 1000)}s`);
    console.log(JSON.stringify(result));
  });
