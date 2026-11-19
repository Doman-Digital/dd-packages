// A changeset that names a private package is never consumed by `changeset version`,
// so the release action sees it as pending for ever and opens an empty "Version Packages"
// PR instead of publishing. That stalled every release for days (DOM-18137).
// Fail the PR that adds one.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const priv = new Set()
for (const dir of readdirSync('packages')) {
  try {
    const pkg = JSON.parse(readFileSync(join('packages', dir, 'package.json'), 'utf8'))
    if (pkg.private) priv.add(pkg.name)
  } catch {}
}

const bad = []
for (const f of readdirSync('.changeset')) {
  if (!f.endsWith('.md') || f === 'README.md') continue
  const head = readFileSync(join('.changeset', f), 'utf8').split('---')[1] ?? ''
  for (const name of priv) if (head.includes(`"${name}"`) || head.includes(`'${name}'`)) bad.push(`${f} names private ${name}`)
}
if (bad.length) {
  console.error(`Changesets may not name a private package (they are never consumed and block releases):\n- ${bad.join('\n- ')}`)
  process.exit(1)
}
console.log('changesets ok')
