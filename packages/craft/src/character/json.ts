/**
 * The `--json` contract. Every JSON document a craft command prints carries
 * `schemaVersion`, so a script reading it can refuse a shape it does not
 * know instead of misreading it. Bump it when a field is removed or changes
 * meaning; adding a field is not a bump.
 */

export const JSON_SCHEMA_VERSION = 1;

/** A command's JSON output, versioned. */
export function toJson(data: object): string {
  return JSON.stringify({ schemaVersion: JSON_SCHEMA_VERSION, ...data }, null, 2);
}
