# HANDOFF · 幸福之家（可移动 2D 线）

> 给后续 AI / 开发者的交接文档。先读本文，再改代码。  
> **最后更新（2026-09-14）**：Day1–7 主链已接通；**可走 FREE_VISIT + 电梯楼层条**；E5/E7/E8/E9 独立结局卡；Day6 猎手赎罪；门前伏击；加载页/HUD/朝向等工程修复仍在。  
> 主页 / 3D / 书籍轮播 **不归本线**。  
> **形态原则**：借 Gal 的节奏壳与立绘/BGM，**不要**把本线改成纯点点看 VN。

---

## 1. 项目是什么

基于小说《近视眼勇闯恐怖游戏》的 **「幸福之家」副本** 互动游戏。

- **卖点**：主角宁念高度近视，把恐怖诡异当家人照顾；惊悚喜剧 + 家庭养成。
- **本仓库负责线**：**可移动同屏 2D**（横版侧视可走房间、靠近互动、AI NPC）。
- **对照参考（外部）**：[LeeShuze/game-zhihu-making](https://github.com/LeeShuze/game-zhihu-making) —— 静态场景热区 Gal；本包已搬其 BGM / 表情立绘 / 部分场景态，**未**接其点选导航。
- **另一条线（非本包）**：固定舞台 AVG / 主页书籍轮播 / 简单 3D ——**不要在本包里接主页**。
- **不建议上 Unity**：网页 Phaser +（主页若需要）Three.js 即可。

### 源材料（工作区根目录）

| 路径 | 用途 |
|------|------|
| `全文_去水印(1).md` | 小说全文（剧情与人设权威） |
| **`幸福之家_全部分支剧情设计.md`** | **Day1–7 分支/结局/旗标设计（扩天数权威策划）** |
| `可移动2D线_一日制作计划.md` | Day1 一日计划与早期验收 |
| `近视眼勇闯恐怖游戏一_前三天18个节点团队执行方案.docx` | 原 18 节点方案 |
| `优化立绘三视图final/` / `imagegen/` | 角色 / 道具美术参考 |
| **`playable/`** | **当前可运行工程（主要改这里）** |
| `playable/AUDIT.md` | 对照 Gal 的终检摘要 |

---

## 2. 怎么跑起来

```bash
cd playable
npx --yes serve -p 5173
```

- http://localhost:5173/ （`index.html` → `play.html`）
- 或 http://localhost:5173/play.html  

**不要用 `file://`**（JSON `fetch` 会失败）。

灌 AI 密钥（OpenAI 兼容）：

```js
localStorage.setItem('hh_api_key', 'sk-...');
localStorage.setItem('hh_api_base', 'https://api.openai.com/v1'); // 可选
localStorage.setItem('hh_api_model', 'gpt-4o-mini');             // 可选
location.reload();
```

无密钥时按 `C` 仍可对话，走 `prompts/npc_stages.json` 兜底短句。

自检：

```bash
cd playable
node tools/audit_flow.js   # 期望 ISSUES none
node --check src/main.js
```

- 存档 key：`hh_movable_day1_v3`（`config.js`）
- 卡关：标题「新的一天」，或 **设置 → 清空进度并重开**
- 换图 / 换 JSON：**改 `config.js` → `assetVer`**，再硬刷新

### 启动体验（必须如此）

1. 标题点「新的一天 / 读档」→ **立刻出现加载页**（进度条 + 文案）  
2. 读完 JSON + Day1 核心贴图/音效 → 关闭加载页 → 旁白/场景  
3. **不应**在黑屏里干等无反馈  

加载 DOM：`#loading`（`play.html`）；逻辑：`showLoading` / `setLoadingProgress` / `hideLoading`（`main.js`）。

---

## 3. 玩法形态（必须遵守）

- **横版侧视**：左右走；背景为墙面平行舞台侧视；禁止斜透视/等距走廊当主房。
- **同屏互动**：靠近提示，`E` 互动，`C` AI；对话锁移动。
- **选项汇流主线**：可改 trust / horror / flags / inventory；**不改出口节点集合**（软分支靠 `when`）。
- **旁白**：`intro` / `briefing` 讲规则与本段目标。
- **自由度**：`FREE_*` 可逛可聊；推进靠唯一 `storyHotspot` + `storyConfirm`。

### 操作

| 键 | 作用 |
|----|------|
| `A/D` `←→` 或左下 ◀▶ | 移动（虚拟键：触屏默认开，桌面默认关，设置可改） |
| `E` / 空格 | 互动 / 推进对话 |
| `C` | AI 对话 |
| **Esc** | 关惊悚记录 → 关存档子面板 → **开关设置** |
| 右上角 **惊悚条** | 打开惊悚变动记录 |
| 右上角 **⚙** | 设置（含存档、背包只读） |
| `` ` `` | 调试跳节点 |
| `P` | 开发跳场景（`config.devCheat`） |

对话栏工具（回退/历史/自动/跳过）默认收成 **⋯**，点开再展开。

---

## 4. 当前进度

### 已完成（Day1–7 主链）

Day1：`P04 → … → END_DAY1`  
Day2：`D2-00 → … → END_DAY2`  
Day3：`D3-00 → … → END_DAY3`  
Day4–5：`FREE_VISIT_D*` 可走楼道 + 电梯楼层条 / 门牌进 `V_*` → 回家  
Day6：对峙 + 猎手赎罪分卡 → `END_DAY6`  
Day7：拼门 →（可选 `D7-AMBUSH`）→ 献心 → `END_CLEAR` / `END_STAY` / `END_FRIENDS` / `END_HUNTER` / `END_FOG` / `END_NOKEY` / `END_AMBUSH`（E3=惊悚 100）

| 模块 | 状态 |
|------|------|
| 五房互通 + 客厅 dirty/clean/night | ✅ |
| 侧视 walk、思思 hug/红裙、热点、灯、餐桌/床确认 | ✅ |
| FREE 闸门 / 软分支 `when` | ✅ |
| 惊悚 0–100、记录、100 即死、积分≈100−惊悚 | ✅ |
| **顶栏 HUD**：左状态 / 中目标 / 右惊悚+设置 | ✅ |
| 对话壳、多槽存档、弹幕、目标箭头 | ✅ |
| BGM 按房切换；Gal 对话立绘左右站位 | ✅ |
| **加载页** + Day1 核心装完再进；延后 BG 静默预取 | ✅ |
| **统一 `assetVer`**（BG/角色/道具/JSON/立绘） | ✅ |
| 玄关血迹地面贴纸 `blood_stain`（`floorDecal`） | ✅ |
| 走动朝向：立绘默认朝左，`setFlipX(vx > 0)` | ✅ |
| Phaser 挂载 `#game-canvas`；热点用 `hotData` 勿覆写 `sprite.data` | ✅ |
| Day2–7 节点 + 日终「进入下一天」 | ✅ |
| **可走 FREE_VISIT + 电梯楼层条 / 门牌** | ✅ |
| Day7 E5/E7/E8/E9 独立结局卡 + 门前伏击 | ✅ |
| Day6 猎手赎罪分卡 | ✅ |

### 未做 / 弱项

- 拜访 BG 侧视化（邻家/楼道预置图仍偏透视）
- 主页 / 3D / 书籍轮播
- 美术温差；`main.js` 仍偏集中；`ui_*.png` 未充分接入
- 资源目录含 `_bak_*` / `_preview` / 大体积 portrait·BGM，发行前宜裁剪

---

## 5. 工程结构

```
playable/
  index.html / play.html     # UI：加载页、顶栏 HUD、设置、Gal 立绘、对话、弹幕…
  config.js                  # API / 分辨率 / groundY / saveKey / assetVer / devCheat
  data/
    day1.nodes.json … day7.nodes.json
    visit.nodes.json / visit_floors.json
    rooms.json / npcs.json / hotspots.json
    unlock_presets.js
  prompts/npc_stages.json
  src/
    main.js                  # Phaser 主场景 + 加载/拆包 + when + HUD/设置
    game/StateStore.js
    game/DialogueShell.js
    game/SaveSlots.js
    game/BgmPlayer.js
    game/PortraitUI.js
    game/AiNpcClient.js
  assets/
    bg/ char/ portrait/ prop/ bgm/ audio/ ui/
  tools/
    audit_flow.js
    cutout_portraits.py
    make_blood_stain.js      # 生成透明血迹贴纸
  HANDOFF.md / README.md / AUDIT.md
```

---

## 5.1 加载与缓存（重要）

### 启动流水线

1. `bootGame` → `showLoading`，隐藏标题  
2. `loadJson` 读 rooms / day1–7 / visit / npcs / hotspots / prompts（进度约 2%→12%）  
3. `new Phaser.Game` → `MainScene.preload` 只装 **Day1 核心**（进度约 12%→98%）  
4. `create` 首帧后 `hideLoading`；约 700ms 后 `prefetchDeferredAssets` 静默拉拜访等 BG  

### 核心 vs 延后

| 批次 | 内容 |
|------|------|
| **核心（进游戏前）** | 主房 BG：`xuanguan/living(day·night·clean)/kitchen/bedroom/bathroom`；走动角色帧；Day1 道具；短 SFX |
| **延后（静默）** | `bg_living_dirty`、`bg_corridor_visit`、`bg_room_*`、`bg_floor10_bones`、`bg_otherworld_gates` |

切房时若目标 BG 尚未在纹理里：`ensureBgTexture` → 短加载页 → 再淡入。Day1 五房已在核心包，日常切房通常只需 fade。

### 统一缓存版本

```js
// config.js
assetVer: '20260914e'   // 换图后只改这一处
```

- `main.js` → `assetUrl(path)` 给 BG / char / prop / audio / JSON  
- `PortraitUI.js` → `?v=${HH_CONFIG.assetVer}`  
- **不要**再散落 `?v=side5` / `walk9` / `cut8` 多套版本号  

Portrait / BGM 仍按需加载（对话时立绘、进房时 BGM），不进首包。

---

## 5.2 UI 布局约定

顶栏三栏（`play.html` `#hud`）：

| 左 | 中 | 右 |
|----|----|-----|
| 房间 + Day/存活/信任 | **`#objective` 当前目标（唯一）** | 精简惊悚条 + ⚙ |

- 背包：设置「状态」里只读，不占顶栏  
- `#hint`：解锁移动后浮现约 18s 再淡出（`showControlHint`）  
- `#move-state`：仅锁定时短暂显示，禁止常驻「检测中」  
- Phaser 画布必须挂在 **`#game-canvas`**（在 `#game-host` 内）；缺节点会黑屏  

---

## 6. 数据契约

### 6.1 `StateStore`（`hh_movable_day1_v3`）

```
day, aliveCount, floor, roomId, playerX, nodeId
horror, horrorLog[]
livingVariant
familyTrust: { sisi, boss, liuaiguo, licuilan }
clues: { wetDress, redSisterClue }
inventory: { mop, towel, ateStrangeFood, cleaver, … }
visitCards, npcChatState
flags: {
  doorsLocked, day1_cleared, useNight, lightsDim, livingClean,
  freeGateToast, horrorDead, frontDoorPeeked,
  refuseMother, pushAway, fearBoss, coldDinner
}
```

### 6.2 惊悚 / 软分支 `when` / 节点字段

**惊悚来源（现行）：**

| 来源 | 是否改惊悚 |
|------|------------|
| 房间热点（观察/拾取/开灯等） | ❌ 不改 |
| 主线台词 / 选项 `horror`·`effects` | ✅ 导演轨仍可改（Boss 入场等） |
| **AI 对话结束**（点「关闭」） | ✅ 裁判小幅 ±0～4 |

AI 结束评判：`AiNpcClient.judgeHorror`（有密钥走 JSON 裁判；无密钥关键词启发式）。认家/照顾降、当怪物/驱赶升；禁止剧烈波动。

同前：行内 `horror` / `horrorSet` / `horrorReason`；选项 `effects`；`when` 多键 AND、仍汇流同一 `next`。  
节点常用：`room` / `lockDoors` / `allowRooms` / `intro` / `briefing` / `approachTrigger` / `storyHotspot` / `guide` / `advanceHint` / **`aiStage`** / `ending` / `unlockMove`。

### 6.3 热点与地面贴纸

`hotspots.json` **不要再写 `horror`/`horrorReason`**（房间交互不驱动惊悚）。血迹示例：

```json
{
  "id": "blood_stain",
  "prop": "blood_stain",
  "floorDecal": true,
  "displayW": 240,
  "displayH": 100
}
```

- `floorDecal: true`：贴地压扁、低 depth；**E 提示贴脚边**（`syncPrompt` 用更小 lift）  
- 无 `prop`：不可见碰撞点（勿再画半透明蓝球）  
- **禁止** `sprite.data = …`（会覆盖 Phaser DataManager，`destroy` 崩溃 → 黑屏/不能动）；用 **`hotData`**

再生血迹图：`node tools/make_blood_stain.js` → `assets/prop/blood_stain.png`

### 6.4 走动朝向

立绘默认 **朝左**。移动时：

```js
this.player.setFlipX(vx > 0); // 向右走才镜像
```

NPC `walkTo` 同理：`setFlipX(pose.walkTo > npc.x)`。

### 6.5 对话立绘 / 客厅 variant / BGM / AI

- 立绘：`PortraitUI.js` + `#vn-stage-chars`；对话时藏走动精灵  
- 客厅：`livingVariant` + `flags.livingClean`；拖把 `mop_blood`  
- BGM：`BgmPlayer.js`；设置键见下表  
- **AI 已分阶段多 prompt**：`prompts/npc_stages.json` → `stages.D1_MEET / D1_MOTHER / D1_BOSS_ENTER / D1_FAMILY / …`；节点 `aiStage` 切入；`AiNpcClient.buildSystemPrompt` = shared + 当前阶段该 NPC 人设  
- 自由探索（如 `FREE_D1`）可靠近 NPC 按 **C / E** 正常聊；关对话时 `closeAiChat` 评判惊悚  
- AI 禁区（第七天钥匙/幸福之心/红姐真相未揭示前）保持  

### 6.6 设置相关 `localStorage`

| key | 含义 |
|-----|------|
| `hh_sfx_mute` / `hh_sfx_vol` | 音效 |
| `hh_mute` / `hh_bgm_vol` | BGM |
| `hh_danmaku` | `0` 关弹幕 |
| `hh_show_pad` | `1` 强制开虚拟键；未设时触屏默认开、桌面默认关 |
| `hh_auto_ms` | 自动播放间隔 |
| `hh_api_*` | API |

---

## 7. 运行时要点（改 `main.js` 前）

- Phaser 3 CDN；1920×1080；`groundY ≈ 980`  
- 父节点：`parent: 'game-canvas'`（与 `play.html` 一致）  
- 移动：`window` key + 触控 pad + `hold`；设置/对话/死亡时锁移动  
- 旁白：`briefing` → continue → `autoDialogue` / `approach`  
- Esc：惊悚面板 → savePanel → toggle 设置  
- 调试：`` ` ``；`window.__hhApplyNode`；`P`（`devCheat`）  

### 曾踩坑（勿回归）

| 现象 | 原因 |
|------|------|
| 进游戏黑屏、画布不在框内 | 缺少 `#game-canvas` 或 parent 写错 |
| 无旁白、不能动、`move-state` 卡死 | 热点 `sprite.data = h` 导致 `destroy` 抛错，场景挂掉 |
| 走路月亮步 | flip 按「默认朝右」写了；立绘实际朝左 |
| 目标文案写两遍 | HUD `#hint` 与 `#objective` 都塞 `advanceHint` |
| 点新游戏长时间黑屏无反馈 | 未显示加载层却在 preload 全量拉图 |

---

## 8. 美术约定

- **场景**：侧视正交舞台；生成声明 **side-scroller orthographic / flat back wall**  
- **走动** `assets/char/`：侧视 idle/walk；**对话** `assets/portrait/`：透明底全身立绘  
- **道具**：场景用正面/`*_icon`；地面血迹用透明 decal  
- 立绘抠图：`tools/cutout_portraits.py`（从 `_bak_opaque` 重跑）；换图后 bump `assetVer`  

---

## 9. 建议下一步

1. 拜访 BG 侧视化（替换偏透视邻家/楼道图）  
2. 拆分 `main.js`；发行包去掉 `_bak`/`_preview`  
3. 真人盲测加载首包体积与移动端触控  
4. 猎手轨更多独立演出（赎罪分卡已有）  

---

## 10. 给后续 AI 的硬约束

1. 先保证 `playable` 可玩，再扩内容；禁止大重构到不能玩。  
2. 剧情以小说 +《全部分支剧情设计》为准。  
3. 选项汇流；软分支用 `when`。  
4. 场景必须侧视；对话立绘保持透明。  
5. 密钥只用 `localStorage`。  
6. 改节点后跑 `node tools/audit_flow.js`。  
7. UI/说明默认 **简体中文**。  
8. 换静态资源只 bump **`config.assetVer`**，并硬刷新验证。  
9. 热点元数据用 **`hotData`**，禁止写 `sprite.data`。  
10. Phaser 必须挂载到 **`#game-canvas`**；启动必须走加载页再进场景。

---

## 11. 快速文件索引

| 要改… | 去… |
|-------|-----|
| Day1–7 / 拜访节点 | `data/dayN.nodes.json`、`visit*.json` |
| 分支设计 | 根目录 `幸福之家_全部分支剧情设计.md` |
| 房间/门/BG | `data/rooms.json` + `assets/bg/` |
| 热点/血迹 | `data/hotspots.json` + `assets/prop/` + `make_blood_stain.js` |
| 走动 / 朝向 / 加载拆包 | `src/main.js` |
| 缓存版本 | `config.js` → `assetVer` |
| 顶栏/加载页/设置 DOM | `play.html` |
| 对话立绘 | `PortraitUI.js` + `assets/portrait/` |
| BGM | `BgmPlayer.js` + `assets/bgm/` |
| 惊悚/存档结构 | `StateStore.js` |
| 自检 | `tools/audit_flow.js` |

---

**验收一句**：`serve` 后走完 Day1→「进入下一天」；Day4 楼道可走，电梯开楼层条或门牌进邻家；可测 E5/E7/E8/E9；`audit_flow.js` 无 ISSUES。
