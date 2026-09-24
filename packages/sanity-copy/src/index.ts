export {
  DEFAULT_EXCLUDED_TYPES,
  DEFAULT_SKIP_FIELDS,
  checkDocumentCopy,
  collectCopy,
  describeFinding,
  pathToString,
  type CopyCheckOptions,
  type CopyFinding,
  type Path,
  type PathSegment,
  type Tier,
} from "./core.js";
export {
  copyCheckRule,
  withCopyCheck,
  withCopyGuard,
  type DocumentActionLike,
  type DocumentActionPropsLike,
  type DocumentActionResultLike,
  type RuleLike,
  type SchemaTypeLike,
} from "./schema.js";
