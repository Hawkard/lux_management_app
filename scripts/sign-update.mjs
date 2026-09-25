#!/usr/bin/env node
// Signs a Lux Management program file (.neu) into a .luxupdate that every Lux install accepts.
//
//   node scripts/sign-update.mjs dist/Lux-Management-2.8.0.neu --key path/to/lux-update-signing-key.json
//   LUX_SIGNING_KEY='{"kty":"EC",...}' node scripts/sign-update.mjs dist/Lux-Management-2.8.0.neu
//
// The .luxupdate goes next to the .neu. Put it in the "Lux updates" folder inside the shared data
// folder, or use Settings > Program updates > Install update from file.
// Never commit the signing key. Anyone with it can publish updates.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { createHash, webcrypto } from 'node:crypto';

const { subtle } = webcrypto;
const args = process.argv.slice(2);
const input = args.find(a => !a.startsWith('--'));
const keyArg = args.includes('--key') ? args[args.indexOf('--key') + 1] : null;
const die = m => { console.error('ERROR: ' + m); process.exit(1); };
if (!input) die('Give the .neu file to sign.');

let jwk;
try { jwk = JSON.parse(keyArg ? readFileSync(keyArg, 'utf8') : (process.env.LUX_SIGNING_KEY || '')); }
catch { die('No signing key. Use --key <file> or set LUX_SIGNING_KEY.'); }
if (!jwk || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.d) die('That is not a Lux signing key.');

const bundle = readFileSync(input);
function bundleInfo(b) {
  const hs = b.readUInt32LE(4), jl = b.readUInt32LE(12);
  const head = JSON.parse(b.subarray(16, 16 + jl).toString('utf8'));
  const res = head.files && head.files.resources && head.files.resources.files;
  if (!res || !res['index.html'] || !res['release.json']) return null;
  const e = res['release.json'], off = 8 + hs + Number(e.offset);
  return JSON.parse(b.subarray(off, off + e.size).toString('utf8'));
}
let info;
try { info = bundleInfo(bundle); } catch { info = null; }
if (!info || !info.version) die('That file is not a Lux Management program file.');

const key = await subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, d: jwk.d }, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
const m = {
  version: info.version,
  sha256: createHash('sha256').update(bundle).digest('hex'),
  size: bundle.length,
  publishedAt: new Date().toISOString(),
  publisher: process.env.LUX_PUBLISHER || 'GitHub release',
  notes: info.notes && typeof info.notes === 'object' ? info.notes : {}
};
const canon = new TextEncoder().encode(JSON.stringify(['lux-update', m.version, m.sha256, m.size, m.publishedAt, m.publisher, m.notes]));
const sig = Buffer.from(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, canon));
const out = join(dirname(input), `lux-update-${m.version}.luxupdate`);
writeFileSync(out, JSON.stringify({ format: 'lux-update', manifest: m, sig: sig.toString('base64'), bundle: bundle.toString('base64') }));
console.log(`Signed ${basename(input)} -> ${basename(out)} (version ${m.version})`);
