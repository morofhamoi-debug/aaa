import { readdir, readFile, access } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const files = [];
const missingImports = [];

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.name.endsWith('.js')) files.push(path);
  }
}

await walk(root);
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    process.stderr.write(`${file}\n${result.stderr}`);
    process.exitCode = 1;
  }
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    const specifier = match[1];
    if (!specifier.startsWith('.')) continue;
    const target = resolve(dirname(file), specifier);
    try { await access(target); }
    catch { missingImports.push(`${file}: ${specifier}`); }
  }
}

if (missingImports.length) {
  console.error('Unresolved relative imports:\n' + missingImports.join('\n'));
  process.exitCode = 1;
}

const html = await readFile(resolve(root, '../index.html'), 'utf8');
const requiredHtml = [
  '<html lang="ru"',
  'id="app"',
  'src="./src/vexa/main.js"',
  'href="./src/vexa/styles.css"',
  'VEXA — Digital Collectibles'
];
const htmlProblems = requiredHtml.filter((token) => !html.includes(token));
if (htmlProblems.length) {
  console.error('Missing VEXA runtime requirements: ' + htmlProblems.join(', '));
  process.exitCode = 1;
}
if (html.includes('src="/src/') || html.includes('href="/src/')) {
  console.error('Root-absolute source paths are not supported by GitHub Pages project URLs.');
  process.exitCode = 1;
}

const packageJson = JSON.parse(await readFile(resolve(root, '../package.json'), 'utf8'));
if (!packageJson.dependencies?.['@supabase/supabase-js'] || !packageJson.dependencies?.three) {
  console.error('VEXA runtime dependencies are missing.');
  process.exitCode = 1;
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`VEXA syntax, relative imports and Pages checks passed for ${files.length} JavaScript modules.`);
