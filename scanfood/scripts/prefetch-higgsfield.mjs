#!/usr/bin/env node
/**
 * Télécharge les assets Higgsfield livrés avec ScanFood dans
 * `public/higgsfield/`, pour que l'application les serve depuis son propre
 * domaine plutôt que depuis le CDN Higgsfield.
 *
 *   npm run higgsfield:prefetch
 *
 * À exécuter une fois après le clone, et à relancer si un asset du
 * manifeste (`lib/higgsfield/assets.ts`) change.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const root = path.resolve(import.meta.dirname, '..');
const outDir = path.join(root, 'public', 'higgsfield');

/** Lit le manifeste TypeScript sans le compiler : file + remote suffisent. */
function readManifest() {
  const source = readFileSync(path.join(root, 'lib', 'higgsfield', 'assets.ts'), 'utf8');
  const cdn = source.match(/const CDN = '([^']+)'/)?.[1];
  if (!cdn) throw new Error('CDN introuvable dans lib/higgsfield/assets.ts');

  const entries = [];
  const re = /file: '([^']+)', remote: `\$\{CDN\}([^`]+)`/g;
  let match;
  while ((match = re.exec(source)) !== null) {
    entries.push({ file: match[1], url: cdn + match[2] });
  }
  return entries;
}

async function download({ file, url }) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(path.join(outDir, file), buffer);
  return buffer.length;
}

const assets = readManifest();
await mkdir(outDir, { recursive: true });

let failures = 0;
for (const asset of assets) {
  try {
    const bytes = await download(asset);
    console.log(`✓ ${asset.file} — ${(bytes / 1024).toFixed(0)} Ko`);
  } catch (error) {
    failures += 1;
    console.warn(`✗ ${asset.file} — ${error.message} (l'application utilisera l'URL CDN)`);
  }
}

console.log(
  failures === 0
    ? `\n${assets.length} assets prêts dans public/higgsfield/.`
    : `\n${assets.length - failures}/${assets.length} assets téléchargés.`,
);
