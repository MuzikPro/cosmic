# 天人 · Cosmic Meridian

A single-page ambient site: a translucent human body floats in a starfield while the
12 regular meridians (and, optionally, the 8 extraordinary vessels) flow in slow qi.
Camera orbit, body rotation, or both; meridian picker; FOV; fullscreen. Settings persist
locally under `3dqiflow:screensaver`.

This is the Screensaver page of [3DQiFlow](https://www.3dqiflow.com) lifted into its own
site. `src/components/Screensaver/`, `src/components/three/`, the body, the meridian
registry and the data files are the same sources as the 3dqiflow repo — sync them from
there rather than editing here.

```bash
npm ci
npm run dev      # http://localhost:5177
npm run build
```

Educational only — not medical advice. Data provenance and licences: see `NOTICE.md`
and `public/models/README.md`.
