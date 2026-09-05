# 人体网格资产来源与许可

## body-skin.glb

- **来源**：NIH 3D 条目 **3DPX-021022「Body, Male」**
  <https://3d.nih.gov/entries/3DPX-021022>
  收录于 Human Reference Atlas 3D Reference Object Library，
  原始文件 `hra-reference-organ-united-male-v1.5.glb`
  （本机副本名为 `3d-vh-m-united.glb`，约 154MB，存放于仓库之外，**未提交**）。
  取其中的 `VH_M_skin` 网格。
- **底层数据**：美国国家医学图书馆 Visible Human Male 数据集
  （Spitzer et al. 1996；Ackerman 1998）。
- **加工**：`scripts/build-body-mesh.py` 顶点聚类抽稀
  185,314 面 → 19,628 面，等比缩放平移进项目坐标系
  （脚底 y=-3.2、头顶 y=3.5，与 `bodyGeometry.BODY` 同框）。
  **几何未作任何变形**，人体比例原样保留。
- **体积**：345 KB（仅 POSITION + 索引，法线由前端 `computeVertexNormals` 计算）。

## body-skin-f.glb

- **来源**：同一 Human Reference Atlas 3D Reference Object Library 的
  **女性皮肤**条目（底层数据：NLM Visible Human Female；核证记录见下文
  VHFSkinV1.2 说明，男女两个条目同为 CC BY 4.0）。
- **加工**：与男体同法——顶点聚类抽稀、等比缩放平移进项目坐标系，
  几何未作变形，人体比例原样保留。
- 应用内署名与改动声明同男体，集中在「声明」页。

## 许可：CC BY 4.0（已核实，2026-08-22）

源站条目页记载：

```
Title      Body, Male (3DPX-021022)
Author     HRA (Human Reference Atlas)
License    CC BY 4.0
Version    ref-organ/united-male/v1.5   （PURL: https://purl.humanatlas.io/ref-organ/united-male/v1.5）
Created    2024-03-06        Published 2025-08-05
```

**核对证据**：本机 `3d-vh-m-united_NIH3D.x3d` 文件头的
`<meta content="6 March 2024" name="created"/>` 与条目页 Created 2024-03-06
逐日吻合，可确认本机副本即该条目文件。

> 先前记录的 `VHFSkinV1.2`（VHF = Visible Human *Female*）是同一
> Reference Object Library 里的**女性皮肤**条目。经查证，**男女两个条目
> 同为 CC BY 4.0**，本仓沿用男性网格，此出入已结清。

### CC BY 4.0 的两项义务与本项目的落实

1. **署名** —
   - 本文件；
   - 应用内：十二经运行左栏常驻短句「人体模型：NIH 3D（Visible Human, NLM）·
     CC BY 4.0 · 详见「声明」页」；全文署名与改动声明集中在顶栏「声明」页
     （src/components/About/AboutPage.tsx，owner 2026-08-26）。
2. **声明改动** — 已改动：抽稀至 19,628 面并等比缩放平移；比例未变、几何未变形。

## 四肢经络对齐

`scripts/measure-limbs.py` 从本网格量出四肢中心线与半径，
`bodyGeometry.BODY.limbs` 与 `flowGeometry` 的四肢 via 点均由该实测值推出
（保持每点"沿肢体的相对位置"与"离体表的余量"不变）。
经络归属与循行侧别沿用原教学设定，重定位只换坐标，未新增循行主张。
躯干与头面 via 点未参与重定位。
