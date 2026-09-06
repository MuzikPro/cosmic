/**
 * 本地壁纸打包（owner 2026-09-05）：把 dist-wallpaper/ 变成可直接放进
 *   Wallpaper Engine（projects/myprojects/<folder>/，含 project.json）
 *   Lively Wallpaper（含 LivelyInfo.json；"Add wallpaper → 选择文件夹/压缩包"）
 * 的文件夹，并压成 release/cosmic-meridian-wallpaper.zip。
 * 用户在宿主里可调的属性 → src/components/Screensaver/wallpaperHost.ts 里映射到设置。
 */
import { copyFile, mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist-wallpaper');
if (!existsSync(join(out, 'index.html'))) { console.error('[wallpaper] dist-wallpaper/index.html missing — run the VITE_WALLPAPER=1 vite build first'); process.exit(1); }
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));

// Wallpaper Engine project.json — type "web"; properties appear in WE's wallpaper settings UI
const project = {
  title: '天人 · Cosmic Meridian',
  description: 'The twelve meridians flowing on a translucent body in a starfield. Ambient, slow, optional generative sound. cosmic.3dqiflow.com',
  type: 'web',
  file: 'index.html',
  preview: 'preview.png',
  tags: ['Abstract', 'Relaxing'],
  contentrating: 'Everyone',
  version: pkg.version,
  general: {
    supportsaudioprocessing: false,
    properties: {
      viewmode: { order: 1, text: 'View mode', type: 'combo', value: 'cameraOrbit', options: [
        { label: 'Camera orbit', value: 'cameraOrbit' }, { label: 'Body rotation', value: 'bodyRotation' }, { label: 'Orbit + rotation', value: 'combined' } ] },
      flowspeed: { order: 2, text: 'Flow speed (%)', type: 'slider', value: 10, min: 5, max: 100, step: 1 },
      bodyopacity: { order: 3, text: 'Body opacity (%)', type: 'slider', value: 38, min: 5, max: 60, step: 1 },
      sound: { order: 4, text: 'Time & Sound (meridian clock soundscape)', type: 'bool', value: false },
      volume: { order: 5, text: 'Volume (%)', type: 'slider', value: 20, min: 0, max: 70, step: 1 },
      overlay: { order: 6, text: 'Time overlay', type: 'combo', value: 'MINIMAL', options: [
        { label: 'Hidden', value: 'OFF' }, { label: 'Minimal', value: 'MINIMAL' }, { label: 'Detailed', value: 'DETAILED' } ] },
      powersaver: { order: 7, text: 'Power saver (30 fps)', type: 'bool', value: false }
    }
  }
};
await writeFile(join(out, 'project.json'), JSON.stringify(project, null, 2));

// Lively Wallpaper — Type 1 = web
const lively = {
  AppVersion: '2.0.0.0', Title: '天人 · Cosmic Meridian', Thumbnail: 'preview.png', Preview: 'preview.png',
  Desc: 'The twelve meridians flowing on a translucent body in a starfield. Ambient, slow, optional generative sound.',
  Author: '3DQiFlow', License: 'Engine MIT; sound design proprietary; body mesh CC BY 4.0 (NIH 3D)', Contact: 'https://cosmic.3dqiflow.com',
  Type: 1, FileName: 'index.html', Arguments: '', IsAbsolutePath: false
};
await writeFile(join(out, 'LivelyInfo.json'), JSON.stringify(lively, null, 2));
const livelyProps = {
  viewmode: { type: 'dropdown', text: 'View mode', value: 0, items: ['cameraOrbit', 'bodyRotation', 'combined'] },
  flowspeed: { type: 'slider', text: 'Flow speed (%)', value: 10, min: 5, max: 100, step: 1 },
  bodyopacity: { type: 'slider', text: 'Body opacity (%)', value: 38, min: 5, max: 60, step: 1 },
  sound: { type: 'checkbox', text: 'Time & Sound', value: false },
  volume: { type: 'slider', text: 'Volume (%)', value: 20, min: 0, max: 70, step: 1 },
  powersaver: { type: 'checkbox', text: 'Power saver (30 fps)', value: false }
};
await writeFile(join(out, 'LivelyProperties.json'), JSON.stringify(livelyProps, null, 2));

await copyFile(join(root, 'public', 'og.png'), join(out, 'preview.png'));
await writeFile(join(out, 'README.txt'), `天人 · Cosmic Meridian — local wallpaper build ${pkg.version}

Wallpaper Engine: copy this folder to  <Steam>/steamapps/common/wallpaper_engine/projects/myprojects/cosmic-meridian/
  then pick it under Installed. Options (view mode, flow speed, opacity, sound, volume, overlay, power saver) are in the wallpaper's settings panel.
Lively Wallpaper: Add wallpaper → choose this folder (or the zip).
Sound: the "Time & Sound" option turns on the meridian-clock soundscape; the host allows autoplay, so it starts on its own.
Runs offline; no accounts, no tracking. Web: https://cosmic.3dqiflow.com  Code: https://github.com/MuzikPro/cosmic
Educational and decorative only — not medical advice.
`);

await mkdir(join(root, 'release'), { recursive: true });
const zip = join(root, 'release', `cosmic-meridian-wallpaper-${pkg.version}.zip`);
execFileSync('zip', ['-qr', zip, '.'], { cwd: out });
console.log(`[wallpaper] packed ${zip}`);
