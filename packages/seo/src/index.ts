export { getSitemapRoutes, getRoutePolicy, isRouteIndexable } from "./policy";
export type { RoutePolicyEntry } from "./policy";

export { getTargetForRoute, findKeywordCannibalization } from "./targets";
export type { PageTarget, TargetIntent, KeywordCannibalization } from "./targets";

export { getRelatedLinks } from "./links";
export type { LinkDeclaration, RelatedLinks, GetRelatedLinksOptions } from "./links";

export { getBreadcrumbTrail } from "./trail";
export type { TrailLabel, TrailEntry } from "./trail";

export { normalizeRoutePath, toPolicyPatterns } from "./normalize";
export type { NormalizeRoutePathOptions, TrailingSlash } from "./normalize";

export { validateCoverage } from "./validate";
export type { CoverageIssue, ValidateCoverageInput } from "./validate";

export { validateRedirects } from "./redirects";
export type { Redirect, RedirectsFile, RedirectIssue, ValidateRedirectsInput } from "./redirects";

export { liveLinkedUrls } from "./backlinks";
export type { Backlink, BacklinkRegister, BacklinkRel, BacklinkStatus, BacklinkKind } from "./backlinks";
