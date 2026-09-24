// Edits package.json the way a person would: existing keys keep their order
// and values, the file keeps its indentation and trailing newline.

export type PackagePatch = {
  scripts: Record<string, string>;
  /** Scripts added only when the key is missing, even with --force. */
  scriptsIfMissing: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
};

export function patchPackageJson(text: string, patch: PackagePatch, force: boolean): { text: string; changes: string[] } {
  const indent = /^([ \t]+)"/m.exec(text)?.[1] ?? "  ";
  const pkg = JSON.parse(text) as Record<string, unknown>;
  const changes: string[] = [];

  const section = (key: string): Record<string, string> => {
    if (!pkg[key] || typeof pkg[key] !== "object") pkg[key] = {};
    return pkg[key] as Record<string, string>;
  };

  const scripts = section("scripts");
  for (const [name, command] of Object.entries(patch.scripts)) {
    if (scripts[name] === command) continue;
    if (name in scripts && !force) continue;
    scripts[name] = command;
    changes.push(`script ${name}`);
  }
  for (const [name, command] of Object.entries(patch.scriptsIfMissing)) {
    if (name in scripts) continue;
    scripts[name] = command;
    changes.push(`script ${name}`);
  }

  for (const key of ["dependencies", "devDependencies"] as const) {
    const wanted = patch[key];
    if (Object.keys(wanted).length === 0) continue;
    const existing = { ...(pkg.dependencies as object), ...(pkg.devDependencies as object) } as Record<string, string>;
    const deps = section(key);
    for (const [name, range] of Object.entries(wanted)) {
      if (name in existing) continue;
      deps[name] = range;
      changes.push(`${key === "dependencies" ? "dependency" : "dev dependency"} ${name}@${range}`);
    }
  }

  if (changes.length === 0) return { text, changes };
  return { text: `${JSON.stringify(pkg, null, indent)}${text.endsWith("\n") ? "\n" : ""}`, changes };
}

export function hasDependency(text: string, name: string): boolean {
  const pkg = JSON.parse(text) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
  return Boolean(pkg.dependencies?.[name] ?? pkg.devDependencies?.[name]);
}
