import { readdir, readFile, access } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(new URL('../src/', import.meta.url).pathname);
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
  for (const match of source.matchAll(/from\s+['"](\.\.?\/[^'"]+)['"]/g)) {
    const target = resolve(dirname(file), match[1]);
    try { await access(target); }
    catch { missingImports.push(`${file}: ${match[1]}`); }
  }
}
if (missingImports.length) {
  console.error('Unresolved relative imports:\n' + missingImports.join('\n'));
  process.exitCode = 1;
}
if (process.exitCode) process.exit(process.exitCode);
console.log(`Syntax and relative-import checks passed for ${files.length} JavaScript modules.`);
