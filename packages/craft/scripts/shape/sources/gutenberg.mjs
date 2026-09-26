// Human baseline, literary: English prose from Project Gutenberg (public domain
// in the US; each is also out of copyright in the UK). Novels and essays
// originally written in English, so no translation's rhythm is measured.
//
//   node scripts/shape/sources/gutenberg.mjs
//
// About forty books, one request every two seconds. Writer = book.

import { Baseline, fetchText, flag, memory, paragraphs, sleep } from "../lib.mjs";

const BOOKS = {
  1342: "Pride and Prejudice", 158: "Emma", 161: "Sense and Sensibility", 1260: "Jane Eyre", 768: "Wuthering Heights",
  1400: "Great Expectations", 98: "A Tale of Two Cities", 766: "David Copperfield", 730: "Oliver Twist", 145: "Middlemarch",
  84: "Frankenstein", 345: "Dracula", 174: "The Picture of Dorian Gray", 43: "Jekyll and Hyde", 120: "Treasure Island",
  35: "The Time Machine", 36: "The War of the Worlds", 219: "Heart of Darkness", 209: "The Turn of the Screw", 1661: "The Adventures of Sherlock Holmes",
  2701: "Moby Dick", 205: "Walden", 514: "Little Women", 74: "Tom Sawyer", 2814: "Dubliners",
  4217: "A Portrait of the Artist", 1952: "The Yellow Wallpaper", 1228: "On the Origin of Species", 5827: "The Problems of Philosophy", 11: "Alice in Wonderland",
  1080: "A Modest Proposal", 64317: "The Great Gatsby", 5230: "The Invisible Man", 105: "Persuasion",
  121: "Northanger Abbey", 141: "Mansfield Park", 550: "Silas Marner", 599: "Vanity Fair", 4276: "North and South",
};

const out = new Baseline({
  source: "gutenberg",
  register: "literary",
  licence: "Public domain (Project Gutenberg)",
  note: "English-language novels and essays, 1726 to 1925. Front matter, licence and chapter headings cut. Writer = book.",
});

for (const [id, title] of Object.entries(BOOKS)) {
  const raw = await fetchText(`https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`);
  await sleep(2000);
  if (!raw) {
    console.error(`  ${id} ${title}: not found`);
    continue;
  }
  const start = raw.search(/\*\*\* ?START OF (?:THE|THIS) PROJECT GUTENBERG[^\n]*\n/i);
  const end = raw.search(/\*\*\* ?END OF (?:THE|THIS) PROJECT GUTENBERG/i);
  const body = raw.slice(start === -1 ? 0 : raw.indexOf("\n", start) + 1, end === -1 ? undefined : end);
  for (const p of paragraphs(body)) {
    // Chapter headings, all-caps lines and illustrations are not prose.
    if (/^(?:chapter|book|part|volume|letter)\b/i.test(p) || p === p.toUpperCase() || /^\[illustration/i.test(p)) continue;
    out.add(p.replace(/_/g, ""), id);
  }
  console.error(`  ${title}: ${out.counts.blurbs} blurbs so far, ${memory()}`);
}
console.log(JSON.stringify(out.write("gutenberg-v1.json", { force: Boolean(flag("force", false)) })));
