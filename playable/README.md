# 幸福之家 · 可移动 2D · 完整 Day1

## 早上这样开

```bash
cd playable
npx --yes serve -p 5173
```

浏览器打开：**http://localhost:5173/play.html**  
（若昨晚服务还在，直接打开即可）

## 完整主线（应能一口气跑完）

1. 新的一天 → 玄关旁白  
2. 观察血迹 → 进客厅  
3. **走近思思**（自动拥抱演出 + 选项）  
4. D1-02 可去浴室拿毛巾 / 看红裙 → 选项推进  
5. Boss 从右侧走入 + 低音 sting + 镜头震动  
6. 自由活动：拾取拖把、开灯、AI 对话（C）  
7. 去厨房靠近餐桌 → 晚餐  
8. 去卧室 → 第一夜 → 结算卡  

## 操作

| 键 | 作用 |
|----|------|
| A/D 或方向键 | 移动（有 walk 帧） |
| E / 空格 | 互动 / 推进对话 |
| C | 对最近 NPC 打开 AI 对话 |
| Esc | 关面板 |
| ` | 调试跳节点 |
| 音效:开/关 | HUD 按钮 |

## 灌密钥（AI 真对话）

```js
localStorage.setItem('hh_api_key', 'sk-...');
location.reload();
```

无密钥时仍可输入，走角色兜底短句。分阶段提示词在 `prompts/npc_stages.json`。

## 自检

```bash
node tools/audit_flow.js
```

应输出 `ISSUES none` 且路径含 P04→…→END_DAY1。

## 已含资源

- 五房：玄关 / 客厅日夜 / 厨房 / 卧室日夜 / 浴室  
- 侧视 walk：宁念、思思、Boss；思思红裙 + hug；祖父母侧视预置  
- 音效：door / ui_click / sting_low / pickup / step  
- 后续预置 BG：走廊、拜访房、10 层白骨、异世之门  

## 不在本包

主页 / 3D 入口 / 第 2–7 天完整玩法（资源与提示词已预置，节点未做玩法）。
