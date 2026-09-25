#!/usr/bin/env node
// Makes a new update signing key and puts its public half into the program.
//
//   node scripts/new-signing-key.mjs path/to/lux-update-signing-key.json
//
// Use it if the key is lost, or if it ever ended up somewhere it shouldn't (a repository, an email,
// a shared folder). It writes the new private key to the file you name (never inside this folder's
// Git history: .gitignore blocks the usual names) and replaces UPDATE_PUBKEY in src/lux-management.html.
//
// Lux only trusts the key built into the version it runs. So publish the first version with the new
// key through the shared folder with the OLD key (Settings > Program updates > Publish an update).
// From that version on, only the new key works, and the old one can be destroyed.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { webcrypto } from 'node:crypto';

const die = m => { console.error('ERROR: ' + m); process.exit(1); };
if (!process.argv[2]) die('Give the file to write the new key to, for example lux-update-signing-key.json');
const out = resolve(process.argv[2]);
if (existsSync(out)) die(`${out} already exists. Move it away first, or give another file name.`);
const src = join(dirname(dirname(fileURLToPath(import.meta.url))), 'src', 'lux-management.html');
const html = readFileSync(src, 'utf8');
const line = /const UPDATE_PUBKEY = \{[^}]*\};/;
if (!line.test(html)) die('Could not find const UPDATE_PUBKEY in src/lux-management.html');

const { privateKey } = await webcrypto.subtle.generateKey({name: 'ECDSA', namedCurve: 'P-256'}, true, ['sign', 'verify']);
const jwk = await webcrypto.subtle.exportKey('jwk', privateKey);
const key = {kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d,
  purpose: 'Lux Management update signing key. Keep secret. Anyone with this file can publish updates.'};
writeFileSync(out, JSON.stringify(key, null, 2) + '\n', {mode: 0o600});
writeFileSync(src, html.replace(line, `const UPDATE_PUBKEY = ${JSON.stringify({kty: 'EC', crv: 'P-256', x: key.x, y: key.y})};`));
console.log(`New signing key written to ${out}`);
console.log('Its public half is now in src/lux-management.html (UPDATE_PUBKEY). Commit that change, never the key file.');
