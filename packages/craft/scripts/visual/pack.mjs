// Build a fillable decision worksheet for one client from its visual review.
//
//   PDF_LIB_DIR=<dir containing node_modules/pdf-lib> node scripts/visual/pack.mjs <dir with review.json + screenshots>
//
// pdf-lib is not a dependency of craft: install it beside the script's caller
// (`npm i pdf-lib` in any scratch directory) and point PDF_LIB_DIR at that directory.
//
// The worksheet follows art direction v2: the job first, then page structure,
// then the seven looks. It recommends nothing. It shows what was seen on the live
// site, from screenshots looked at by eye, and asks the person deciding for the
// customer's job, then choices with reasons in their own words. Field names are
// stable (job.*, page.<n>.*, tok.<name>.*) so a filled copy can be copied into
// art-direction.json word for word.

import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { SECTION_ROLES } from "../../dist/index.js";

const dir = resolve(process.argv[2] ?? "");
const lib = process.env.PDF_LIB_DIR;
if (!process.argv[2] || !lib) throw new Error("usage: PDF_LIB_DIR=<dir> node scripts/visual/pack.mjs <client dir>");
const { PDFDocument, StandardFonts, rgb } = createRequire(join(lib, "x.js"))("pdf-lib");
const review = JSON.parse(readFileSync(join(dir, "review.json"), "utf8"));

const W = 595;
const H = 842;
const M = 48;
const INK = rgb(0.1, 0.11, 0.13);
const MUTED = rgb(0.4, 0.42, 0.46);
const RULE = rgb(0.8, 0.82, 0.85);
const ACCENT = rgb(0.13, 0.32, 0.27);

const clean = (s) => String(s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/→/g, "->").replace(/[^\x09\x0a\x0d\x20-\x7e\xa3\xb7…]/g, "");

const pdf = await PDFDocument.create();
const font = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
const form = pdf.getForm();
const pages = [];
let page;
let y;

function newPage() {
  page = pdf.addPage([W, H]);
  pages.push(page);
  y = H - M;
  return page;
}

function wrap(text, f, size, width) {
  const out = [];
  for (const para of clean(text).split("\n")) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (f.widthOfTextAtSize(next, size) > width && line) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

function need(h) {
  if (y - h < M + 24) newPage();
}

function text(t, { size = 10, f = font, color = INK, width = W - 2 * M, gap = 4, indent = 0 } = {}) {
  for (const line of wrap(t, f, size, width - indent)) {
    need(size + gap);
    page.drawText(line, { x: M + indent, y: y - size, size, font: f, color });
    y -= size + gap;
  }
}

const heading = (t, size = 16) => {
  need(size + 14);
  y -= 4;
  text(t, { size, f: bold, gap: 6 });
};

const bullet = (t) => {
  const lines = wrap(t, font, 10, W - 2 * M - 14);
  need(lines.length * 14);
  page.drawText("-", { x: M + 2, y: y - 10, size: 10, font, color: MUTED });
  for (const line of lines) {
    page.drawText(line, { x: M + 14, y: y - 10, size: 10, font, color: INK });
    y -= 14;
  }
  y -= 2;
};

let n = 0;
function field(name, label, { height = 26, multiline = false, hint, value } = {}) {
  text(label, { size: 9, f: bold, color: ACCENT, gap: 3 });
  if (hint) text(hint, { size: 8.5, color: MUTED, gap: 3 });
  need(height + 8);
  const f = form.createTextField(name);
  if (multiline) f.enableMultiline();
  if (value) f.setText(clean(value));
  f.addToPage(page, { x: M, y: y - height, width: W - 2 * M, height, borderWidth: 1, borderColor: RULE, font });
  f.setFontSize(10);
  y -= height + 10;
  n += 1;
}

function boxes(name, label, options) {
  text(label, { size: 9, f: bold, color: ACCENT, gap: 3 });
  need(22);
  let x = M;
  for (const [key, caption] of options) {
    const w = font.widthOfTextAtSize(clean(caption), 10);
    if (x + 20 + w > W - M) {
      x = M;
      y -= 20;
      need(22);
    }
    const c = form.createCheckBox(`${name}.${key}`);
    c.addToPage(page, { x, y: y - 13, width: 13, height: 13, borderWidth: 1, borderColor: MUTED });
    page.drawText(clean(caption), { x: x + 19, y: y - 11, size: 10, font, color: INK });
    x += 19 + w + 22;
  }
  y -= 28;
}

// ------------------------------------------------------------- cover
newPage();
text(`${review.name}: job, page structure and look`, { size: 20, f: bold, gap: 8 });
text(`${review.site}`, { size: 10, color: MUTED });
text(`Tracked as ${review.issue}. Live site looked at on ${review.capturedAt}.`, { size: 10, color: MUTED, gap: 12 });

heading("What this is", 13);
text("A worksheet for deciding how this client's public site should work and look, and why. It replaces the earlier decision PDF, whose recommendations rested on evidence that did not hold up. It recommends nothing. Everything under 'What is on the site today' is what was visible in screenshots, described by eye.", { gap: 6 });

heading("What is different this time", 13);
bullet("Three steps, in this order: the job (who is visiting and what they need), the page structure (what leads, where the main action sits), then the seven looks.");
bullet("The page layout is now part of the decision. The old rule that section order and button positions must not move is withdrawn (craft CHARACTER.md, 26 September). Keeping the current layout is fine, but it needs a reason too.");
bullet("Every reason is in your own words and is about this client's customer. 'Industry standard', 'best practice', 'visitors expect it', 'it looks professional' and 'it is familiar' do not count as reasons.");
bullet("Do not look at what other businesses in the same trade do. Take evidence from this client's customers: reviews, enquiries, conversations, what people search for.");
bullet("An option must come from something the client has: the logo, premises, paperwork, their trade or their customers. Anything can change, nothing is kept just because it is there.");

heading("How to fill it in", 13);
bullet("Open in Preview on a Mac, or the Files app on an iPhone. Type into the boxes and tick the tick boxes.");
bullet("Where the site shows something marked 'to check', do not treat it as true until it is checked.");
bullet("Save the filled copy, attach it to the same Linear issue and move the issue to Done.");
bullet("It counts as decided when the job is written, every page listed in Part 2 has all four answers, and at least five of the seven looks have a choice and a reason.");

// ------------------------------------------------------------- screenshots
newPage();
heading("What the live site looked like");
text("Screenshots taken by machine and looked at by eye. The cookie banner was left as found; nothing was clicked or submitted.", { size: 9, color: MUTED, gap: 8 });
const shots = review.shots;
for (const [file, caption] of shots) {
  const img = await pdf.embedJpg(readFileSync(join(dir, file)));
  const mobile = /mobile/.test(file);
  const h = mobile ? 300 : ((W - 2 * M) * img.height) / img.width;
  const w = mobile ? (h * img.width) / img.height : W - 2 * M;
  need(h + 26);
  y -= 4;
  page.drawRectangle({ x: M - 1, y: y - h - 1, width: w + 2, height: h + 2, borderColor: RULE, borderWidth: 1 });
  // PACK_NO_IMAGES draws grey boxes: some PDF renderers used for previews cannot decode embedded JPEGs.
  if (process.env.PACK_NO_IMAGES) page.drawRectangle({ x: M, y: y - h, width: w, height: h, color: rgb(0.85, 0.87, 0.9) });
  else page.drawImage(img, { x: M, y: y - h, width: w, height: h });
  page.drawText(clean(caption), { x: M, y: y - h - 12, size: 8.5, font, color: MUTED });
  y -= h + 24;
}

// ------------------------------------------------------------- seen / check
newPage();
heading("What is on the site today");
text(`Pages looked at: ${review.pages.join(", ")}.`, { size: 9, color: MUTED, gap: 8 });
for (const s of review.seen) bullet(s);
y -= 6;
heading("To check before relying on any of it", 13);
for (const c of review.check) bullet(c);
y -= 4;
text(review.method, { size: 8.5, color: MUTED });

// ------------------------------------------------------------- part 1: job
newPage();
heading("Part 1: the job");
text("Who visits this site and what are they trying to get done? Write about the customer, not about the business or its competitors. Use what you know from real reviews, enquiries and conversations.", { size: 9.5, gap: 8 });
field("job.who", "Who visits, and what has just happened to make them look?", { height: 54, multiline: true });
text("They want to ...", { size: 9, f: bold, color: ACCENT, gap: 3 });
field("job.verb", "an action word (find, book, decide, check, get, arrange ...)", { height: 22 });
field("job.object", "what they want to get done. Not 'a ${trade} website' or the trade itself".replace("${trade}", "trade"), { height: 30, multiline: true });
field("job.context", "in what situation, under what pressure (today, cheaply, without being talked down to ...)", { height: 30, multiline: true });
field("job.functional", "What has to get done (the practical need)", { height: 40, multiline: true });
field("job.emotional", "How they want to feel by the end", { height: 40, multiline: true });
boxes("job.consideration", "How long do they take to decide?", [["low", "Low: minutes or a day"], ["considered", "Considered: days"], ["high", "High: weeks or months"]]);
field("job.consideration.why", "Why that speed (from what customers actually do)", { height: 40, multiline: true });

newPage();
heading("Part 1: the job (continued)");
field("job.social", "Who do they have to explain or justify the choice to, and what would make them look good or bad?", { height: 44, multiline: true });
field("job.objections", "What worries them before getting in touch? What has gone wrong for them or people they know?", { height: 60, multiline: true });
field("job.language", "Their own words for the problem and for what they want. Exact quotes, one per line", { height: 70, multiline: true });
field("job.sources", "Where each of those came from (a review, an enquiry, a conversation, a search). Names and dates, not links to other businesses' sites", { height: 60, multiline: true });

// ------------------------------------------------------------- part 2: structure
for (const [i, name] of review.pagesForStructure.entries()) {
  newPage();
  heading(`Part 2: page structure, ${name}`);
  text("Decide what this page is for, what leads, and what order it runs in. Keeping today's order is allowed, with a reason.", { size: 9.5, gap: 8 });
  field(`page.${i + 1}.name`, "Page", { height: 22, value: name });
  field(`page.${i + 1}.action.what`, "The one main action a visitor should take on this page (for example: call now, book, send an enquiry)", { height: 30, multiline: true });
  boxes(`page.${i + 1}.positions`, "Where the main action sits (tick all that apply)", [["header", "Header"], ["hero", "First screen"], ["after-proof", "After proof or reviews"], ["mid", "Middle of page"], ["footer", "Bottom of page"], ["sticky", "Stays on screen"]]);
  field(`page.${i + 1}.action.why`, "Why it sits there. Say how fast the customer decides, or which worry it answers", { height: 44, multiline: true });
  field(`page.${i + 1}.order`, "The order the sections should run, top to bottom, one per line, each with a few words on why", { height: 110, multiline: true, hint: `Section names craft understands: ${SECTION_ROLES.join(", ")}.` });
  field(`page.${i + 1}.lead`, "What leads (the one thing seen first) and what is deliberately smaller", { height: 44, multiline: true });
}

// ------------------------------------------------------------- part 3: looks
const TOKENS = [
  ["display", "Display face", "The typeface for headlines.", review.today.display],
  ["body", "Body face", "The typeface for text, buttons and forms.", review.today.body],
  ["accent", "Accent colour", "The one colour that means 'press this'.", review.today.accent],
  ["ground", "Ground", "The page colour.", review.today.ground],
  ["shape", "Shape", "How corners and edges look.", review.today.shape],
  ["motif", "Motif", "The one recurring detail.", review.today.motif],
  ["signature", "Signature", "The one moment of motion, or none.", review.today.signature],
];
for (const [i, [key, label, what, today]] of TOKENS.entries()) {
  newPage();
  heading(`Part 3: look ${i + 1} of 7, ${label}`);
  text(what, { size: 10, color: MUTED, gap: 8 });
  text("On the site today (seen by eye)", { size: 9, f: bold, color: ACCENT, gap: 3 });
  text(today, { gap: 10 });
  boxes(`tok.${key}.decision`, "Your decision", [["keep", "Keep what is there"], ["change", "Change it"], ...(key === "signature" ? [["none", "None: no motion"]] : [])]);
  field(`tok.${key}.value`, key === "accent" || key === "ground" ? "What it should be. A colour name, or a hex code taken from something the client has" : "What it should be", { height: 40, multiline: true });
  field(`tok.${key}.source`, "Where it comes from: the logo, the premises, paperwork, the trade or the customers", { height: 40, multiline: true });
  field(`tok.${key}.why`, "Why, in your own words, about this client's customer", { height: 90, multiline: true });
}

// ------------------------------------------------------------- sign-off
newPage();
heading("Sign-off");
field("signoff.by", "Decided by", { height: 24 });
field("signoff.date", "Date", { height: 24 });
field("signoff.open", "Anything you could not decide, and what you would need to decide it", { height: 90, multiline: true });

pages.forEach((p, i) => p.drawText(clean(`${review.name}  -  page ${i + 1} of ${pages.length}  -  craft art direction v2 worksheet`), { x: M, y: 24, size: 8, font, color: MUTED }));

const out = join(dir, `${resolve(dir).split("/").pop()}-look-decisions.pdf`);
writeFileSync(out, await pdf.save());
console.log(`${out}: ${pages.length} pages, ${n} text fields`);
