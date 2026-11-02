export interface DenyList {
  salt: string;
  canary: string;
  hashes: Set<string>;
}
export interface Hit {
  line: number;
  form: string;
}
export interface FileHit extends Hit {
  file: string;
}
export const DENY_LIST: string;
export function loadDenyList(path?: string): DenyList;
export function formsOf(line: string): string[];
export function scanText(text: string, list: DenyList): Hit[];
export function walk(path: string, skip?: Set<string>): string[];
export function scanFiles(files: string[], list: DenyList, base?: string): FileHit[];
export function shippedFiles(pkgDir: string): string[];
export function formatHit(hit: FileHit): string;
