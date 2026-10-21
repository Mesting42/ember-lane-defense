# 战术模块金属徽章

2026-10-18 按用户选择的立体金属徽章风格制作，采用灰蓝装甲、冷青能源、暖铜结构，统一为近正视的八角装备外壳。使用内置 ImageGen 生成透明 PNG，不使用实时三维渲染。

| 文件名 | 用途 | 识别图案 |
| --- | --- | --- |
| module | 模块选择页主徽章、未知模块回退 | 能源核心与铜色护翼 |
| relaySync | 火控协同 | 联动炮座与瞄准核心 |
| coil | 磁芯重铸 | 铜线圈与磁轨核心 |
| salvage | 战场回收 | 机械夹爪与合金锭 |
| ember | 余烬弹链 | 三联实体弹药链 |
| coldAftershock | 凝霜回响 | 六向冰晶与冲击环 |
| droneCare | 蜂巢协议 | 维修无人机与修复标志 |
| alloy | 钨铼弹芯 | 强化穿甲弹 |
| bossBreaker | 旗舰识别码 | 旗舰与锁定准星 |

- `originals/`：9 张生成的原始透明 PNG。
- `generation.json`：每张图的完整提示词、生成方式及原始文件来源。
- `runtime-assets.json`：正式资源尺寸和文件大小。
- `preview.png`：深色背景上的整套预览，仅用于查看素材，不是浏览器页面截图。
- `../../public/assets/modules/`：384 × 384 的透明 WebP，9 张总计 445,976 字节。

重新打包：用安装了 Pillow 的 Python 执行 `tools/pack-module-badges.py`。打包只调整尺寸与编码，不改变徽章图案。React 组件 `src/ModuleBadge.tsx` 按模块 ID 选择素材，不根据奖励卡片的位置选择；未知模块使用主徽章回退。
