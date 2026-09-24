// Shapes of the modules a generated site exports, for the dynamic imports in
// generated-site.test.ts.
import type { JsonLdGraph } from "@domandigital/graph";
import type { PageTarget, RoutePolicyEntry } from "@domandigital/seo";

export declare const Routes: { policy: RoutePolicyEntry[]; moneyRoutes: string[]; targets: PageTarget[] };
export declare const Facts: { facts: { url: string } };
export declare const PageGraph: { buildPageGraph: (page: { path: string; name: string }) => JsonLdGraph };
