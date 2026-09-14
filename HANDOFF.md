# HANDOFF（工作区入口）

可运行游戏与完整交接说明在：

**[playable/HANDOFF.md](./playable/HANDOFF.md)** ← **先读这个**

近期摘要（2026-09-14）：Day1–7 主链可玩；已有加载页 + Day1 核心资源拆包；顶栏「左状态 / 中目标 / 右惊悚」；血迹地面贴纸；走动朝向修正；`assetVer` 统一缓存。楼层条 UI / 拜访 BG 侧视化仍弱。

### 本目录材料

| 路径 | 用途 |
|------|------|
| `全文_去水印(1).md` | 小说原文（剧情权威） |
| `可移动2D线_一日制作计划.md` | Day1 制作计划与验收口径 |
| **`幸福之家_全部分支剧情设计.md`** | **Day1–7 全部分支/结局设计底稿（扩天数必读）** |
| `近视眼勇闯恐怖游戏一_前三天18个节点团队执行方案.docx` | 原 18 节点团队方案 |
| `优化立绘三视图final/` | 角色美术（走动侧参考） |
| `imagegen/` | 道具美术 |
| **`playable/`** | Phaser 可玩工程 |
| `playable/AUDIT.md` | 对照 Gal 改进的终检摘要 |

### 启动

```bash
cd playable
npx --yes serve -p 5173
```

打开 http://localhost:5173/ 或 `/play.html`（**勿用 `file://`**）。

- 存档 key：`hh_movable_day1_v3`（`playable/config.js`）
- 卡关：设置里清进度，或标题「新的一天」
- 换图后改 `config.js` 的 **`assetVer`**，再硬刷新
- 点「新的一天」应先出加载页，进度满再进游戏（不应长时间黑屏）
