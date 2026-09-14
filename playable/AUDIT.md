# 终检报告（对照 Gal 改进后）

## 主路径
`P04 → D1-01 → D1-02 → D1-03 → D1-03b → FREE_D1 → D1-04 → D1-04b → D1-05 → END_DAY1`  
`node tools/audit_flow.js` → **ISSUES none**

## 本轮已落地（对照 GitHub Gal）
- FREE 闸门：全屋 `allowRooms` + `exploreHint` + 餐桌/床 `storyConfirm`
- Day1 文案加厚：system / danmaku / 惊悚起伏
- 对话壳：历史 / 回退 / 自动 / 跳过
- 惊悚值 HUD + StateStore.horror
- 客厅打扫后 variant 标记（拖把）
- 多槽存档 UI（存档 key → `hh_movable_day1_v3`）
- 轻量拆分：`DialogueShell.js` / `SaveSlots.js` / `unlock_presets.js`

## 未做（明确延后）
- Day2–7 玩法；楼层条
- main.js 完整拆成 Player/Interact/NodeDirector

## 本轮资源搬运（GitHub Gal → 可移动线）
- `assets/bgm/`：8 首 mp3，按房间自动切（客厅音乐盒 / Boss 紧张 / 夜曲）
- `assets/portrait/`：24 张对话立绘（已抠透明，`?v=cut8`）；剧情行可用 `"portrait": "boss_angry"`
- 白底备份：`portrait/_bak_opaque/`；重抠：`python tools/cutout_portraits.py`
- `bg_living_dirty/clean`：打扫前后；捡血拖把切换 clean
- `mop_blood` 图标：客厅拖把热点

## 场景侧视 + Gal 对话（本轮）
- Day1 主房 BG 已换成偏立面/侧视舞台图（旧正面图备份在 `assets/bg/_bak_frontish/`）
- 对话改为 Gal 站位：左右大立绘在对话框后，说话者高亮、另一侧压暗；走动精灵对话时隐藏
- 点对话框空白 / 空格 / 继续 均可推进

刷新 `play.html`（BG `?v=side5`，立绘 `?v=cut8`）后验：客厅/厨房应更扁；立绘无白底；Boss 登场左右双人立绘。

完整契约与约束以 **[HANDOFF.md](./HANDOFF.md)** 为准。
