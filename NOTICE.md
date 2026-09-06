# Licensing map

This repository intentionally contains material under more than one license.
The `LICENSE` file (MIT) covers **source code only**. Everything else is listed
here.

| What | Where | License |
| --- | --- | --- |
| Source code (TS/TSX, scripts, configs) | everywhere except below | [MIT](LICENSE) |
| Body mesh assets | `public/models/*.glb` | **CC BY 4.0** (see below) |
| Sample content data (articles, formulas, acupoints, pulses, tongues, …) | `src/data/` | **CC BY-NC 4.0** (attribution, non-commercial) |
| Commercial content pack (full 96 articles, 39 formulas, full 定位 texts, curriculum) | *not in this repository* — overlaid at deploy time | proprietary, all rights reserved |
| Sound design pack (`cosmic-sound`: element characters, palettes, progression, cadence, vessel modulation, levels) | *not in this repository* — overlaid into `src/audio/pack/` at deploy time by `scripts/fetch-sound-pack.mjs`; `src/audio/fallback/` is the open reference pack | proprietary, all rights reserved |

## CC BY 4.0 assets — attribution

The 3D body meshes are derivatives of CC BY 4.0 sources. Redistribution of this
repository must keep these attributions (they are also shown in-app on the
声明/About page):

- **`public/models/body-skin.glb`** (male body surface) — NIH 3D entry
  **3DPX-021022 "Body, Male"**, Human Reference Atlas 3D Reference Object
  Library (underlying data: Visible Human Male, U.S. National Library of
  Medicine; Spitzer et al. 1996, Ackerman 1998). CC BY 4.0.
  *Modifications:* vertex-cluster decimation 185,314 → 19,628 faces, uniform
  scale/translation into project coordinates; proportions and geometry
  otherwise unaltered. Details: [`public/models/README.md`](public/models/README.md).
- **`public/models/body-skin-f.glb`** (female body surface) — female skin entry
  of the same Human Reference Atlas 3D Reference Object Library (underlying
  data: Visible Human Female, NLM). CC BY 4.0. Same decimation and
  scale/translation treatment as the male mesh.
- **Vertebra ladder used in acupoint back-region derivation** — HuBMAP CCF 3D
  Reference Object Library; Browne, K., Schlehlein, H., Herr II, B. W.,
  Quardokus, E., Bueckle, A., Börner, K. (2022). CC BY 4.0.
- **Toe positioning reference (male lower limb)** — Visible Human Male phalanx
  registration, University of Denver Center for Orthopaedic Biomechanics.
  CC BY 4.0.

## Text sources

- 《圆运动的古中医学》 (Peng Ziyi, d. 1949) and 《伤寒论》 original texts are in
  the public domain; interpretations and annotations in `src/data/` are
  project-written (CC BY-NC 4.0 as sample content).
- Acupoint 定位 wording follows GB/T 12346-2021《經穴部位》. Because the
  standard's text is publicly viewable but not freely redistributable, this
  repository carries only an 11-point sample (手太阴肺经); the remaining 351
  entries ship with the commercial content pack, not with this repo.

## Not licenses

Coordinates in `src/data/acupoints*.ts` are schematic teaching positions
(`schematic_unvalidated`) — see the file headers. No license here changes their
status: they must not be used to locate points on a real person.
