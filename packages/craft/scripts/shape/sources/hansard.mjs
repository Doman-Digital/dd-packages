// Human baseline, UK institutional: House of Commons debates, 2010 to 2019,
// from TheyWorkForYou's Hansard XML (Open Parliament Licence).
//
//   node scripts/shape/sources/hansard.mjs [--days 150]
//
// Spoken and then edited by the Hansard reporters, so this is formal UK
// English rather than anyone's marketing. An evenly spaced sample of sitting
// days, one request a second. Writer = member (person id).

import { Baseline, fetchText, flag, memory, sleep } from "../lib.mjs";

const BASE = "https://www.theyworkforyou.com/pwdata/scrapedxml/debates/";
const days = Number(flag("days", 150));

const decode = (s) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const index = await fetchText(BASE);
if (!index) throw new Error("TheyWorkForYou index unavailable");
// The last version of each sitting day: debates2019-01-08a.xml, then b, c.
const latest = new Map();
for (const m of index.matchAll(/debates(201\d-\d\d-\d\d)([a-z])\.xml/g)) {
  if (!latest.has(m[1]) || latest.get(m[1]) < m[2]) latest.set(m[1], m[2]);
}
const all = [...latest.entries()].sort();
const step = Math.max(1, Math.floor(all.length / days));
const sample = all.filter((_, i) => i % step === 0).slice(0, days);

const out = new Baseline({
  source: "hansard-commons",
  register: "institutional",
  licence: "Open Parliament Licence; XML from TheyWorkForYou (mySociety)",
  note: `House of Commons debates 2010 to 2019, ${sample.length} sitting days evenly spaced. Each <p> of a speech is a paragraph. Writer = member.`,
});

for (const [i, [day, v]] of sample.entries()) {
  const xml = await fetchText(`${BASE}debates${day}${v}.xml`);
  await sleep(1000);
  if (!xml) continue;
  for (const speech of xml.matchAll(/<speech\b([^>]*)>([\s\S]*?)<\/speech>/g)) {
    const person = speech[1].match(/person_id="([^"]+)"/)?.[1];
    if (!person) continue;
    for (const p of speech[2].matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/g)) out.add(decode(p[1]), person);
  }
  if ((i + 1) % 25 === 0) console.error(`  ${i + 1}/${sample.length} days, ${out.counts.blurbs} blurbs, ${memory()}`);
}
console.log(JSON.stringify(out.write("hansard-commons-v1.json", { force: Boolean(flag("force", false)) })));
