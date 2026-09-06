/**
 * Sound-pack overlay (deploy-time only) — mirrors 3dqiflow's content-pack script.
 *
 * The open-source repo ships the audio ENGINE and a plain reference sound pack
 * (src/audio/fallback). The composition layer — element characters, palettes,
 * progression, cadence, vessel modulation, level balance — is the private repo
 * MuzikPro/cosmic-sound. At deploy time this prebuild step fetches it into
 * src/audio/pack/ (gitignored); Vite's `@pack` alias then prefers it.
 *
 * Env:
 *   SOUND_PACK_TOKEN   GitHub token with read-only Contents access to the private repo
 *                      (falls back to CONTENT_PACK_TOKEN if that one can read it)
 *   SOUND_PACK_REPO    owner/repo (default MuzikPro/cosmic-sound)
 *   SOUND_PACK_REF     git ref (default main)
 *   SOUND_PACK_FORCE   set to 1 to run outside Vercel (local testing)
 *
 * Production builds on Vercel FAIL without a token so the live site never
 * silently regresses to the reference pack; previews and local builds fall back.
 */
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const token = process.env.SOUND_PACK_TOKEN ?? process.env.CONTENT_PACK_TOKEN;
const onVercel = process.env.VERCEL === '1';
const production = process.env.VERCEL_ENV === 'production';
const force = process.env.SOUND_PACK_FORCE === '1';
const repo = process.env.SOUND_PACK_REPO ?? 'MuzikPro/cosmic-sound';
const ref = process.env.SOUND_PACK_REF ?? 'main';
const packDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'audio', 'pack');

if (!token) {
  if (onVercel && production) {
    console.error('[sound-pack] SOUND_PACK_TOKEN missing on a PRODUCTION build — refusing to ship the reference pack. Add the token in Vercel → Settings → Environment Variables.');
    process.exit(1);
  }
  console.log(existsSync(join(packDir, 'index.ts'))
    ? '[sound-pack] no token — using the local src/audio/pack checkout.'
    : '[sound-pack] no token — building with the open-source reference sound pack.');
  process.exit(0);
}
if (!onVercel && !force) {
  console.log('[sound-pack] not a Vercel build (set SOUND_PACK_FORCE=1 to override) — using whatever is in src/audio/pack (or the reference pack).');
  process.exit(0);
}

const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
async function listFiles() {
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/?ref=${ref}`, { headers });
  if (!res.ok) throw new Error(`list: ${res.status} ${res.statusText}`);
  return (await res.json()).filter((e) => e.type === 'file' && /\.(ts|json)$/.test(e.name));
}
async function fetchRaw(path) {
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=${ref}`, { headers: { ...headers, Accept: 'application/vnd.github.raw+json' } });
  if (!res.ok) throw new Error(`fetch ${path}: ${res.status} ${res.statusText}`);
  return res.text();
}
try {
  const files = await listFiles();
  await rm(packDir, { recursive: true, force: true });
  await mkdir(packDir, { recursive: true });
  for (const f of files) await writeFile(join(packDir, f.name), await fetchRaw(f.path));
  console.log(`[sound-pack] overlaid ${files.length} files from ${repo}@${ref} into src/audio/pack/.`);
} catch (err) {
  console.error('[sound-pack] overlay failed:', err.message);
  process.exit(1);
}
