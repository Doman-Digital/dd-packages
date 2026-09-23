export {
  type Gamut,
  type Oklch,
  type Rgb,
  deltaEOk,
  deltaEOkHex,
  formatHex,
  hexToOklch,
  inP3Gamut,
  inSrgbGamut,
  oklchToRgb,
  parseHex,
} from "./color/oklch.js";
export { type OklchToHexOptions, oklchToHex, toGamut } from "./color/gamut.js";
export {
  type Ramp,
  type RampOptions,
  type RampFromAnchorsOptions,
  type RampStep,
  LIGHTNESS_CURVE,
  RAMP_STEPS,
  ramp,
  rampFromAnchors,
} from "./color/ramp.js";
export {
  type ContrastCheck,
  apcaContrast,
  checkPair,
  wcagContrast,
} from "./color/contrast.js";
export {
  type AccentFork,
  type AccentForkOptions,
  type ContrastReport,
  type SemanticInput,
  type SemanticResult,
  accentFork,
  semantic,
} from "./color/semantic.js";
export {
  type DurationName,
  type EaseName,
  DURATION_MS,
  DURATION_S,
  EASE,
  EASE_TUPLE,
  EXIT_RATIO,
  SCALE,
  SPRING,
  exitDuration,
} from "./motion/tokens.js";
export {
  type MotionDecision,
  type MotionKind,
  type ShouldAnimateInput,
  shouldAnimate,
} from "./motion/decide.js";
export {
  type CraftTokensInput,
  type CraftTokensResult,
  type EmitCssOptions,
  craftTokens,
  emitCss,
  motionTokens,
} from "./css/emit.js";
export {
  type FluidTypeOptions,
  type FluidTypeResult,
  type TypeStep,
  TYPE_STEPS,
  fluidClamp,
  fluidType,
} from "./type/scale.js";
export { HOUSE_TYPE, typeFeatureTokens } from "./type/features.js";
export {
  type FluidSpaceOptions,
  type SectionRhythmOptions,
  type SpaceStep,
  SPACE_STEPS,
  fluidSpace,
  sectionRhythm,
} from "./space/scale.js";
export {
  type DensityCssOptions,
  type DensityName,
  DENSITIES,
  densityCss,
  densityTokens,
} from "./density/index.js";
export {
  type CheckRestraintInput,
  type RestraintBudget,
  type RestraintReport,
  type RestraintSeverity,
  type RestraintViolation,
  HOUSE_BUDGET,
  checkRestraint,
} from "./restraint/index.js";
export {
  type TailwindPreset,
  DENSITY_NAMES,
  tailwindV3Preset,
  tailwindV4Theme,
} from "./css/tailwind.js";
export {
  type CheckOptions,
  type CheckReport,
  type CopyTell,
  type Finding,
  type Generation,
  type Hit,
  type Severity,
  type SourceFile,
  type SourceTell,
  type Surface,
  type Tell,
  type TellException,
} from "./character/types.js";
export {
  CATALOGUE,
  CATALOGUE_VERSION,
  catalogueTable,
  checkCopy,
  runTell,
  scanSource,
  tellById,
} from "./character/check.js";
export { formatReport } from "./character/format.js";
export { auditSnapshot } from "./character/check.js";
export { RENDERED_PATHS } from "./snapshot/rendered.js";
export { makeSnapshot, type SnapshotPatch } from "./snapshot/fixture.js";
export { fontClass, normaliseFamily, type FontClass } from "./snapshot/fonts.js";
export {
  SNAPSHOT_VERSION,
  type SectionKind,
  type Snapshot,
  type SnapshotColour,
  type SnapshotControl,
  type SnapshotEffects,
  type SnapshotFont,
  type SnapshotGradient,
  type SnapshotHeading,
  type SnapshotMotion,
  type SnapshotSection,
} from "./snapshot/types.js";
export {
  DISTANCE_WEIGHTS,
  FINGERPRINT_VERSION,
  fingerprint,
  fingerprintDistance,
  nearest,
  type Fingerprint,
  type FingerprintDistance,
} from "./fingerprint/index.js";
export { AI_VIOLET, findColours, isAiViolet, isCream, parseColour } from "./character/color.js";
export {
  PILL_LIMIT,
  REFLEX_FONTS_1,
  REFLEX_FONTS_2,
  REVEAL_LIMIT,
  SHADCN_LIMIT,
  SHADCN_PRIMITIVES,
} from "./character/tells/source.js";
export {
  AI_PHRASES,
  AI_WORDS,
  BUZZWORDS,
  NEGATIVE_REASSURANCE,
  PLAINER_WORDS,
  REVIEW_PHRASES,
  STOCK_PHRASES,
  VAGUE_WORDS,
} from "./character/tells/copy.js";
