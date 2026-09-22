/**
 * The shapes shared by the tell catalogue, the source scanner and the copy
 * engine.
 *
 * A tell is a choice an AI model makes when nobody told it otherwise. It is not
 * a mistake. Every tell here would be fine as a decision; it is flagged because
 * it is the answer the model reaches for first, so a site full of them reads as
 * nobody having decided anything.
 */

/**
 * Which wave of model defaults a tell belongs to.
 *
 * 1: the first wave (indigo, blue-to-purple gradients, Inter, glass cards).
 * 2: what models moved to once the first wave was named and banned (cream and
 *    italic serif, eyebrow chips, bento grids, the marquee).
 * 3: reserved for what the harvester finds next.
 *
 * The tag exists because any fixed list goes stale. Knowing which wave a tell
 * came from is what lets a report say "this site was built in 2024" rather
 * than only "this site has tells".
 */
export type Generation = 1 | 2 | 3;

/** Where a tell is detected. `rendered` arrives with the snapshot in phase B. */
export type Surface = "source" | "copy";

/**
 * `warn` is reported and never fails a run unless `--strict` is passed.
 * `block` fails a run.
 *
 * Every entry ships as `warn`. A rule blocks only after its hits across the
 * estate have been read by a person and the rule tuned against them. A rule
 * that blocks on day one gets switched off by day three.
 */
export type Severity = "warn" | "block";

export interface SourceFile {
  /** Repo-relative path. The extension decides how the file is read. */
  path: string;
  text: string;
}

export type FixtureCase = SourceFile | SourceFile[];

/** A detector's raw result, before it is placed on a line. */
export interface Hit {
  path: string;
  /** Character offset into the file's text. */
  offset: number;
  message: string;
  /** Overrides the excerpt taken from the offset's line. */
  excerpt?: string;
}

export interface Finding {
  tell: string;
  name: string;
  generation: Generation;
  severity: Severity;
  path: string;
  /** 1-indexed. */
  line: number;
  excerpt: string;
  message: string;
  fix: string;
}

/** A class list as it applies to one element, with where it starts. */
export interface ClassUnit {
  classes: string[];
  offset: number;
}

export interface CssDeclaration {
  property: string;
  value: string;
  /** The innermost rule's prelude: a selector, `@theme`, `@font-face`. */
  selector: string;
  offset: number;
}

/** A file read once, so every detector works from the same parse. */
export interface ParsedFile extends SourceFile {
  kind: "markup" | "script" | "css" | "prose" | "other";
  classUnits: ClassUnit[];
  declarations: CssDeclaration[];
}

export interface ScanContext {
  files: ParsedFile[];
}

export interface CopyBlock {
  path: string;
  text: string;
  /** Offset of `text[0]` in the original file, so hits land on real lines. */
  offset: number;
}

export interface CopyContext {
  files: SourceFile[];
  blocks: CopyBlock[];
}

interface TellBase {
  /** Stable kebab-case id. Exceptions, suppressions and reports refer to it. */
  id: string;
  name: string;
  generation: Generation;
  severity: Severity;
  /** Why this is a default rather than a decision, in one or two sentences. */
  why: string;
  /** What to do instead. Specific enough to act on without reading anything else. */
  fix: string;
  /**
   * Proof the rule can fire and can stay quiet. Each entry needs at least one
   * of each, and the catalogue test runs both: a guard that cannot fail is not
   * a guard.
   *
   * Each item is one case, run on its own: a file, or an array of files for a
   * tell that only exists across several. One case per detection path, so a
   * path that breaks cannot hide behind one that still works.
   */
  fixtures: { flag: FixtureCase[]; pass: FixtureCase[] };
}

export interface SourceTell extends TellBase {
  surface: "source";
  detect(ctx: ScanContext): Hit[];
}

export interface CopyTell extends TellBase {
  surface: "copy";
  detect(ctx: CopyContext): Hit[];
}

export type Tell = SourceTell | CopyTell;

/**
 * A declared reason to keep a tell. Lives in the site's `art-direction.json`.
 *
 * DD's own brand is violet. A hue rule with no way to say so flags the agency's
 * own site on every commit, and gets switched off. An exception without a
 * `because` is not applied: the reason is the point.
 */
export interface TellException {
  tell: string;
  because: string;
  /** Where the reason comes from: the shopfront, the van, the trade's own look. */
  evidence?: string;
  /** Limit the exception to paths containing this string. */
  path?: string;
}

export interface CheckOptions {
  exceptions?: TellException[];
  /** Run only these tell ids. */
  only?: string[];
}

export interface CheckReport {
  catalogueVersion: string;
  findings: Finding[];
  /** Exceptions that were declared but not applied, and why. */
  rejectedExceptions: { exception: TellException; reason: string }[];
  /** Findings each applied exception silenced, so an exception stays visible. */
  excepted: { tell: string; because: string; count: number }[];
  summary: {
    files: number;
    findings: number;
    byGeneration: Record<Generation, number>;
    byTell: Record<string, number>;
    blocking: number;
  };
}
