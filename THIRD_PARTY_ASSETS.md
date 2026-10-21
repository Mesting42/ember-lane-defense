# 第三方美术素材

## Low Poly Sci Fi Turrets

- 作者：Zsky（@Zsky_01）
- 原始来源：https://zsky2000.itch.io/low-poly-sci-fi-turrets
- 许可：Creative Commons Attribution 4.0 International（CC BY 4.0）
- 许可链接：https://creativecommons.org/licenses/by/4.0/
- 原始包：`art-source/zsky/SciFi_Turrets.zip`
- 原始许可：`art-source/zsky/License.txt`
- 原始包 SHA-256：`928BBB8B70905DFEA05D03466F88135DF04E30FD96941B661F25E4B34DA67DF5`

本项目修改了材质、配色、尺寸、灯光及模型部件组织，增加了中继天线结构，并制作底座、32 方向旋转部件、设施图标及枪口锚点。游戏内的“素材鸣谢”链接指向 `public/credits.html`，提供作者、原始来源、许可及修改说明。原作者未参与或认可本游戏制作。

| 游戏设施 | 原始模型 | 修改 |
| --- | --- | --- |
| 针蜂 | GatelngGunTurret | 金属材质、底座/炮头拆分 |
| 轨矛 | RailGunTurret | 金属材质、磁轨枪口锚点 |
| 弧光 | LightingTurret | 冷青能源球、放电锚点 |
| 彗星 | MissileTurret | 双发射口锚点、灰蓝装甲 |
| 冷凝 | PlasmaTurret | 冷凝能源与装甲材质改造 |
| 巡游蜂巢 | HiveTurret | 蜂巢金属材质改造 |
| 脉冲哨塔 | EMPTurret1 | 保留基座和立柱，增加天线碟及支撑结构 |
| 护盾冲击塔 | ShieldTurret | 冷青能源、装甲材质 |
| 诱导震荡塔 | EMPTurret1 | 暖铜脉冲环、灰蓝中心立柱 |

## 重新制作图集

推荐采用离线制作流程（Node.js 和安装了 Pillow 的 Python）：

```powershell
node tools/render-towers-offline.mjs
python tools/pack-towers.py
```

该流程直接读取原始 GLB 的网格和材质，使用深度缓冲渲染底座与炮头，再打包到正式资源目录。Pillow 仅负责编码和拼图；原始三维几何保留在 `art-source/zsky/models/`。`rendered-raw/` 为可重新生成的中间文件。

离线打包同时输出普通版（每帧 192 × 192）与 `-hd` 高清版（每帧 384 × 384），高清版使用原始渲染像素。两版的世界尺寸、旋转帧和枪口锚点一致；`tower-atlas.json` 中的锚点继续采用 192 像素的逻辑坐标。浏览器 WebGL 制作工具仅输出普通版，更新高清素材请使用以上离线流程。

也可以用浏览器 WebGL 制作：

1. 运行 `npm install` 和 `npm run dev`。
2. 打开开发服务器的 `/tools/render-towers.html`。
3. 点击“生成九类设施素材”，检查预览后下载素材包。
4. 将底座、炮头、图标、总览和署名文件放入 `public/assets/towers/`；将 `tower-atlas.json` 放入 `src/generated/`。
5. 保留 `License.txt`、本文件及游戏内的素材鸣谢。

Three.js 和 fflate 仅作为制作工具的开发依赖使用，不进入游戏运行时的 JavaScript 包。正式游戏采用预渲染图片，模型源文件不包含在 `dist/` 中。

## Kenney Space Kit — 敌方舰群

- 作者：Kenney
- 来源：https://kenney.nl/assets/space-kit
- 许可：CC0 1.0 Universal；原始许可保留在 `art-source/kenney/License.txt`。
- 原始包：`art-source/kenney/kenney_space-kit.zip`
- SHA-256：`D5D7CDF2635ED5A43A9187DEAF409B6F47484E402321128341D3C3698E9EF4D9`
- 模型映射：侦察机 / speederA，攻城机 / miner，裂解单位 / speederB，干扰机 / speederC，跃迁单位 / racer，护盾运输机 / cargoA，裂解子机 / speederD，旗舰 / cargoB。
- 修改：重新配色、引擎与威胁模块、32 方向预渲染、敌群识别图标。

重新制作：

```powershell
node tools/render-enemies.mjs
python tools/pack-enemies.py
```

正式资源为 `public/assets/enemies/`，方向与尺寸数据在 `src/generated/enemy-atlas.json`。制作和测试工具仅作为开发依赖，不进入游戏运行时代码。

敌军打包工具同样输出每帧 192 像素的普通图集和每帧 384 像素的 `-hd.webp` 高清图集。游戏按画质分别加载资源，敌军尺寸和朝向规则相同。
