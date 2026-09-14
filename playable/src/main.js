(() => {
  const CFG = window.HH_CONFIG;
  const store = new StateStore(CFG.saveKey);

  let rooms = {};
  let nodes = {};
  let npcsData = {};
  let hotspots = [];
  let visitFloors = {};
  let prompts = {};
  let ai = null;
  let audioUnlocked = false;

  const ui = {
    boot: document.getElementById('boot'),
    dialogue: document.getElementById('dialogue'),
    dlgName: document.getElementById('dlg-name'),
    dlgText: document.getElementById('dlg-text'),
    dlgChoices: document.getElementById('dlg-choices'),
    aiRow: document.getElementById('ai-row'),
    aiInput: document.getElementById('ai-input'),
    prompt: document.getElementById('prompt'),
    guide: document.getElementById('guide'),
    objective: document.getElementById('objective'),
    debug: document.getElementById('debug'),
    debugPre: document.getElementById('debug-pre'),
    toast: document.getElementById('api-toast'),
    endCard: document.getElementById('end-card'),
    floorBar: document.getElementById('floor-bar'),
    floorList: document.getElementById('floor-list'),
    savePanel: document.getElementById('savePanel'),
    saveSlotList: document.getElementById('saveSlotList'),
    danmakuLayer: document.getElementById('danmaku-layer'),
    hudNode: document.getElementById('hud-node'),
    hudRoom: document.getElementById('hud-room'),
    hudVariant: document.getElementById('hud-variant'),
    hudDay: document.getElementById('hud-day'),
    hudAlive: document.getElementById('hud-alive'),
    hudCards: document.getElementById('hud-cards'),
    hudHorror: document.getElementById('hud-horror'),
    hudTs: document.getElementById('hud-ts'),
    hudTb: document.getElementById('hud-tb'),
    hudInv: document.getElementById('hud-inv'),
    hint: document.getElementById('hint'),
    muteBtn: document.getElementById('btn-mute'),
    saveBtn: document.getElementById('btn-save'),
    btnLeft: document.getElementById('btn-left'),
    btnRight: document.getElementById('btn-right'),
    btnAct: document.getElementById('btn-act'),
    moveState: document.getElementById('move-state'),
    horrorPanel: document.getElementById('horrorPanel'),
    horrorList: document.getElementById('horrorList'),
    horrorMeta: document.getElementById('horrorMeta'),
    horrorFlash: document.getElementById('horror-flash'),
    horrorBar: document.getElementById('horror-bar'),
    horrorBandEl: document.getElementById('horror-band'),
    horrorMeter: document.getElementById('horror-meter'),
    deathCard: document.getElementById('death-card'),
    settingsPanel: document.getElementById('settingsPanel'),
    settingsSlotList: document.getElementById('settingsSlotList'),
    pad: document.getElementById('pad'),
    cheatPanel: document.getElementById('cheatPanel'),
    cheatList: document.getElementById('cheatList'),
    loading: document.getElementById('loading'),
    loadingText: document.getElementById('loading-text'),
    loadingBar: document.getElementById('loading-bar'),
    loadingPct: document.getElementById('loading-pct'),
  };

  function assetUrl(path) {
    const v = CFG.assetVer || '1';
    if (!path) return path;
    return path.includes('?') ? `${path}&v=${v}` : `${path}?v=${v}`;
  }

  function showLoading(text) {
    if (!ui.loading) return;
    ui.loading.classList.add('show');
    ui.loading.setAttribute('aria-busy', 'true');
    if (text && ui.loadingText) ui.loadingText.textContent = text;
  }

  function hideLoading() {
    if (!ui.loading) return;
    ui.loading.classList.remove('show');
    ui.loading.setAttribute('aria-busy', 'false');
    if (ui.loadingBar) ui.loadingBar.style.width = '0%';
    if (ui.loadingPct) ui.loadingPct.textContent = '0%';
  }

  function setLoadingProgress(ratio, text) {
    const p = Math.max(0, Math.min(1, Number(ratio) || 0));
    if (text && ui.loadingText) ui.loadingText.textContent = text;
    if (ui.loadingBar) ui.loadingBar.style.width = `${Math.round(p * 100)}%`;
    if (ui.loadingPct) ui.loadingPct.textContent = `${Math.round(p * 100)}%`;
  }

  const settings = {
    sfxMute: localStorage.getItem('hh_sfx_mute') === '1' || localStorage.getItem('hh_mute') === '1',
    sfxVol: Number(localStorage.getItem('hh_sfx_vol') || '0.7'),
    danmaku: localStorage.getItem('hh_danmaku') !== '0',
    showPad: localStorage.getItem('hh_show_pad') === '1'
      || (localStorage.getItem('hh_show_pad') == null && typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches),
    autoMs: Number(localStorage.getItem('hh_auto_ms') || '2200'),
  };

  function isSettingsOpen() {
    return !!ui.settingsPanel?.classList.contains('open');
  }

  function syncToggleBtn(el, on, onLabel, offLabel) {
    if (!el) return;
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
    el.textContent = on ? onLabel : offLabel;
  }

  function applyPadVisibility() {
    if (!ui.pad) return;
    ui.pad.classList.toggle('visible', !!settings.showPad);
  }

  function syncSettingsForm() {
    const bgmMuted = !!window.BgmPlayer?.isMuted?.();
    const bgmVol = Number(window.BgmPlayer?.getVolume?.() ?? (localStorage.getItem('hh_bgm_vol') || 0.35));
    syncToggleBtn(document.getElementById('opt-sfx-mute'), !settings.sfxMute, '开启', '静音');
    syncToggleBtn(document.getElementById('opt-bgm-mute'), !bgmMuted, '开启', '静音');
    syncToggleBtn(document.getElementById('opt-danmaku'), settings.danmaku, '显示', '隐藏');
    syncToggleBtn(document.getElementById('opt-pad'), settings.showPad, '显示', '隐藏');
    const sfxRange = document.getElementById('opt-sfx-vol');
    const bgmRange = document.getElementById('opt-bgm-vol');
    const autoSel = document.getElementById('opt-auto-speed');
    if (sfxRange) sfxRange.value = String(Math.round(settings.sfxVol * 100));
    if (bgmRange) bgmRange.value = String(Math.round(bgmVol * 100));
    if (autoSel) {
      const v = String(settings.autoMs);
      if (![...autoSel.options].some((o) => o.value === v)) {
        autoSel.value = '2200';
      } else autoSel.value = v;
    }
    applyPadVisibility();
  }

  function refreshSettingsSlots() {
    const list = ui.settingsSlotList;
    if (!list || !window.SaveSlots) return;
    list.innerHTML = '';
    SaveSlots.list().forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'slot-row';
      const label = document.createElement('span');
      label.textContent = SaveSlots.formatMeta(entry);
      row.appendChild(label);
      const loadBtn = document.createElement('button');
      loadBtn.type = 'button';
      loadBtn.textContent = '读取';
      loadBtn.disabled = !!entry.empty;
      loadBtn.onclick = () => {
        if (SaveSlots.loadFromSlot(entry.slot)) {
          closeSettings();
          ui.savePanel?.classList.remove('open');
          bootGame(true);
        } else toast('该槽位为空');
      };
      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.textContent = '写入';
      saveBtn.onclick = () => {
        if (!window.__hhGame) {
          toast('请先进入游戏再存档');
          return;
        }
        store.data.savedAt = Date.now();
        SaveSlots.saveToSlot(entry.slot, store.data);
        toast(`已写入槽位 ${entry.slot}`);
        refreshSettingsSlots();
        refreshSaveSlotList('manage');
      };
      row.appendChild(loadBtn);
      row.appendChild(saveBtn);
      list.appendChild(row);
    });
  }

  function openSettings({ showSave = false } = {}) {
    if (!ui.settingsPanel) return;
    syncSettingsForm();
    const block = document.getElementById('settingsSaveBlock');
    if (block) {
      block.hidden = !showSave;
      if (showSave) refreshSettingsSlots();
    }
    ui.settingsPanel.classList.add('open');
    setMoveHud(window.__hhGame?.scene.getScene('main'));
  }

  function closeSettings() {
    ui.settingsPanel?.classList.remove('open');
    setMoveHud(window.__hhGame?.scene.getScene('main'));
  }

  function toggleSettings() {
    if (isSettingsOpen()) closeSettings();
    else openSettings();
  }

  function applyLineHorror(line) {
    if (!line) return;
    const snippet = (line.text || '').replace(/\s+/g, ' ').slice(0, 32);
    const reason = line.horrorReason || (snippet ? `剧情：${snippet}${snippet.length >= 32 ? '…' : ''}` : '剧情触发');
    if (line.horror) {
      store.setHorror(line.horror, { relative: true, reason, source: 'dialogue' });
    }
    if (line.horrorSet != null) {
      store.setHorror(line.horrorSet, {
        relative: false,
        reason: line.horrorReason || reason,
        source: 'dialogue',
      });
    }
  }

  function getStatePath(path) {
    if (!path) return undefined;
    return path.split('.').reduce((cur, key) => (cur == null ? undefined : cur[key]), store.data);
  }

  /** 选项/台词 when：{ "flags.refuseMother": true }；无 when 则始终通过 */
  function whenPass(when, state) {
    if (!when || typeof when !== 'object') return true;
    const data = state || store.data;
    return Object.entries(when).every(([path, expect]) => {
      if (path === 'horrorGte') return (Number(data.horror) || 0) >= expect;
      if (path === 'horrorLt') return (Number(data.horror) || 0) < expect;
      if (path === 'visitCardsGte') return (Number(data.visitCards) || 0) >= expect;
      if (path === 'visitCardsLt') return (Number(data.visitCards) || 0) < expect;
      const v = path.split('.').reduce((cur, key) => (cur == null ? undefined : cur[key]), data);
      if (expect && typeof expect === 'object' && !Array.isArray(expect)) {
        if (expect.gte != null) return Number(v) >= expect.gte;
        if (expect.lte != null) return Number(v) <= expect.lte;
        if (expect.gt != null) return Number(v) > expect.gt;
        if (expect.lt != null) return Number(v) < expect.lt;
      }
      if (typeof expect === 'boolean') return !!v === expect;
      return v === expect;
    });
  }

  function filterByWhen(list) {
    if (!Array.isArray(list)) return list || [];
    return list.filter((item) => whenPass(item?.when));
  }

  function availableVisitFloors() {
    const day = Number(store.data.day) || 1;
    const node = nodes[store.data.nodeId] || {};
    const minDay = node.visitDayMin || day;
    return Object.entries(visitFloors || {})
      .map(([floor, info]) => ({ floor, ...(info || {}) }))
      .filter((f) => (Number(f.dayMin) || 1) <= Math.max(day, minDay))
      .sort((a, b) => Number(b.floor) - Number(a.floor));
  }

  function resolveVisitHomeNode(node) {
    if (!node) return 'D4-HOME';
    const flag = node.visitHomeFlag;
    if (flag && store.data.flags?.[flag] && node.visitHomeAlt) return node.visitHomeAlt;
    return node.visitHomeNode || node.visitHomeAlt || 'D4-HOME';
  }

  function closeFloorBar() {
    if (!ui.floorBar) return;
    ui.floorBar.classList.remove('open');
    ui.floorBar.setAttribute('aria-hidden', 'true');
  }

  function openFloorBar() {
    const node = nodes[store.data.nodeId];
    if (!node?.floorBar) {
      toast('现在不能用电梯');
      return;
    }
    if (store.data.flags.horrorDead) return;
    closeSettings?.();
    closeHorrorPanel?.();
    const cardsEl = document.getElementById('floor-bar-cards');
    const dayEl = document.getElementById('floor-bar-day');
    if (cardsEl) cardsEl.textContent = String(store.data.visitCards || 0);
    if (dayEl) dayEl.textContent = String(store.data.day || 4);
    if (ui.floorList) {
      ui.floorList.innerHTML = '';
      availableVisitFloors().forEach((f) => {
        const done = !!(f.visitFlag && store.data.flags[f.visitFlag]);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = (done ? 'done ' : '') + (f.danger ? 'danger' : '');
        btn.innerHTML = `${f.name || (f.floor + '层')}<span class="meta">${done ? '已拜访 · 可再进' : '未拜访'}${f.meetOnly ? ' · 找人' : ''}${f.danger ? ' · 高危' : ''}</span>`;
        btn.onclick = () => startVisitFloor(f.floor);
        ui.floorList.appendChild(btn);
      });
    }
    ui.floorBar?.classList.add('open');
    ui.floorBar?.setAttribute('aria-hidden', 'false');
  }

  function startVisitFloor(floorKey) {
    const info = visitFloors[String(floorKey)];
    if (!info?.node) {
      toast('这层打不开');
      return;
    }
    const day = Number(store.data.day) || 1;
    if ((Number(info.dayMin) || 1) > day) {
      toast('这层还没解锁');
      return;
    }
    closeFloorBar();
    const scene = window.__hhGame?.scene.getScene('main');
    const cur = nodes[store.data.nodeId];
    store.data.visitReturnNode = cur?.id || store.data.visitReturnNode || 'FREE_VISIT_D4';
    store.data.floor = Number(floorKey) || store.data.floor;
    store.save();
    refreshHud();
    playSfx('door', 0.3);
    toast(`前往 ${info.name || (floorKey + '层')}`);
    scene?.applyNode?.(info.node);
  }

  function leaveVisitHome() {
    closeFloorBar();
    const node = nodes[store.data.nodeId];
    const dest = resolveVisitHomeNode(node);
    store.data.floor = 30;
    store.save();
    const scene = window.__hhGame?.scene.getScene('main');
    scene?.applyNode?.(dest);
  }

  function renderHorrorLog() {
    if (!ui.horrorList || !ui.horrorMeta) return;
    const h = store.data.horror ?? 0;
    const band = StateStore.horrorBand(h);
    const pts = StateStore.clearPoints(h);
    ui.horrorMeta.innerHTML =
      `当前 <b>${h}</b>（${band.label}）· 若此刻通关约 <b>${pts}</b> 积分<br/>` +
      `原书：害怕程度；<b>100 即死</b>；积分 ≈ 100−惊悚；老手通常压在 <b>60</b> 以内。认家人照顾会降，恐惧/质疑会升。`;
    const log = (store.data.horrorLog || []).slice().reverse();
    if (!log.length) {
      ui.horrorList.innerHTML = '<p style="color:var(--muted);font-size:13px">尚无变动。剧情、选项与热点会写入原因。</p>';
      return;
    }
    ui.horrorList.innerHTML = log.map((e) => {
      const up = e.delta > 0;
      const cls = e.delta > 0 ? 'up' : e.delta < 0 ? 'down' : 'zero';
      const sign = e.delta > 0 ? `+${e.delta}` : `${e.delta}`;
      const range = e.delta === 0 ? `${e.to}` : `${e.from} → ${e.to}`;
      return `<div class="horror-item">
        <div class="delta ${cls}">${sign}</div>
        <div>
          <p class="why">${e.reason || '（无说明）'}</p>
          <p class="meta">${range} · ${e.nodeId || '?'} · ${e.source || ''}</p>
        </div>
      </div>`;
    }).join('');
  }

  function openHorrorPanel() {
    renderHorrorLog();
    if (ui.horrorPanel) ui.horrorPanel.hidden = false;
  }

  function closeHorrorPanel() {
    if (ui.horrorPanel) ui.horrorPanel.hidden = true;
  }

  function showHorrorFlash(delta) {
    if (!ui.horrorFlash || !delta) return;
    ui.horrorFlash.textContent = delta > 0 ? `惊悚 ${delta > 0 ? '+' : ''}${delta}` : `惊悚 ${delta}`;
    ui.horrorFlash.className = delta > 0 ? 'show up' : 'show down';
    clearTimeout(showHorrorFlash._t);
    showHorrorFlash._t = setTimeout(() => {
      ui.horrorFlash.className = '';
    }, 1200);
  }

  function triggerHorrorDeath() {
    const scene = window.__hhGame?.scene.getScene('main');
    if (scene) {
      scene.playerCanMove = false;
      scene.dialogueOpen = true;
      scene.closePanels?.();
    }
    const el = document.getElementById('death-stats');
    if (el) {
      el.textContent = `最终惊悚 100 · 节点 ${store.data.nodeId} · 可打开记录查看死因链`;
    }
    ui.deathCard?.classList.add('open');
    openHorrorPanel();
  }

  store.onHorrorChange = (info) => {
    refreshHud();
    showHorrorFlash(info.delta);
    if (info.dead) triggerHorrorDeath();
  };

  const moveKeys = { left: false, right: false };
  let activeChoiceHandler = null;
  const hold = { left: false, right: false };

  function clearMoveInputs() {
    moveKeys.left = false;
    moveKeys.right = false;
    hold.left = false;
    hold.right = false;
  }

  function setMoveFromCode(code, down) {
    if (code === 'KeyA' || code === 'ArrowLeft') moveKeys.left = down;
    if (code === 'KeyD' || code === 'ArrowRight') moveKeys.right = down;
  }

  function bindPadHold(el, side) {
    if (!el) return;
    const set = (v) => (e) => {
      e.preventDefault();
      hold[side] = v;
    };
    el.addEventListener('pointerdown', set(true));
    el.addEventListener('pointerup', set(false));
    el.addEventListener('pointerleave', set(false));
    el.addEventListener('pointercancel', set(false));
  }
  bindPadHold(ui.btnLeft, 'left');
  bindPadHold(ui.btnRight, 'right');
  ui.btnAct?.addEventListener('click', (e) => {
    e.preventDefault();
    const scene = window.__hhGame?.scene.getScene('main');
    if (!scene || isSettingsOpen()) return;
    if (activeChoiceHandler) {
      activeChoiceHandler();
      return;
    }
    scene.tryInteract?.();
  });

  function setMoveHud(scene) {
    if (!ui.moveState) return;
    if (!scene) {
      ui.moveState.classList.remove('show');
      return;
    }
    const locked = !scene.playerCanMove || scene.dialogueOpen || scene.aiOpen || isSettingsOpen() || isCheatOpen() || !!store.data.flags.horrorDead;
    // 仅在锁定时短暂露出，避免常驻调试感
    if (locked) {
      const why = isCheatOpen() ? '（开挂选关）'
        : isSettingsOpen() ? '（设置中）'
        : scene.dialogueOpen ? '（对话中）'
        : '';
      ui.moveState.textContent = `移动锁定${why}`;
      ui.moveState.style.color = '#c45c5c';
      ui.moveState.classList.add('show');
    } else {
      ui.moveState.classList.remove('show');
    }
  }

  function showControlHint(ms = 18000) {
    if (!ui.hint) return;
    ui.hint.textContent = 'A/D 移动 · E 互动 · C 对话 · Esc 设置';
    ui.hint.classList.add('show');
    clearTimeout(showControlHint._t);
    showControlHint._t = setTimeout(() => ui.hint?.classList.remove('show'), ms);
  }

  window.addEventListener('keydown', (e) => {
    setMoveFromCode(e.code, true);
    const k = e.key.toLowerCase();
    if (['arrowleft', 'arrowright', ' ', 'a', 'd'].includes(k)) e.preventDefault();
    // 对话选项可用 Enter / Space 确认第一个（或带 unlockMove 的）按钮
    if ((k === 'enter' || k === ' ') && activeChoiceHandler && !isSettingsOpen() && !isCheatOpen()) {
      e.preventDefault();
      activeChoiceHandler();
      return;
    }
  }, { passive: false });
  window.addEventListener('keyup', (e) => {
    setMoveFromCode(e.code, false);
  });
  window.addEventListener('blur', clearMoveInputs);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearMoveInputs();
  });
  // 焦点落到按钮/输入框时清掉方向键，避免 keyup 丢失导致滑行
  window.addEventListener('focusin', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'BUTTON' || t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
      clearMoveInputs();
    }
  });

  const SFX = {};

  function toast(msg) {
    ui.toast.textContent = msg;
    ui.toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => ui.toast.classList.remove('show'), 2800);
  }

  function playSfx(key, vol = 0.45) {
    if (settings.sfxMute || !SFX[key]) return;
    try {
      const a = SFX[key].cloneNode();
      a.volume = Math.max(0, Math.min(1, vol * settings.sfxVol));
      a.play().catch(() => {});
    } catch (_) {}
  }

  function refreshHud() {
    const s = store.data;
    const room = rooms[s.roomId];
    if (ui.hudNode) ui.hudNode.textContent = s.nodeId;
    const settingsNode = document.getElementById('settings-node');
    if (settingsNode) settingsNode.textContent = s.nodeId;
    ui.hudRoom.textContent = room?.name || s.roomId;
    ui.hudDay.textContent = s.day;
    ui.hudAlive.textContent = s.aliveCount;
    if (ui.hudCards) {
      ui.hudCards.textContent = s.visitCards || 0;
      const wrap = document.getElementById('hud-cards-wrap');
      if (wrap) wrap.hidden = (s.day || 1) < 4;
    }
    if (ui.hudHorror) {
      const h = s.horror ?? 0;
      ui.hudHorror.textContent = h;
      const band = StateStore.horrorBand(h);
      ui.hudHorror.className = `band-${band.key}`;
      if (ui.horrorBar) ui.horrorBar.style.width = `${Math.max(0, Math.min(100, h))}%`;
      if (ui.horrorBandEl) ui.horrorBandEl.textContent = band.label;
      if (ui.horrorMeter) ui.horrorMeter.title = `点击查看变动记录 · ${band.tip}`;
    }
    ui.hudTs.textContent = s.familyTrust.sisi;
    ui.hudTb.textContent = s.familyTrust.boss;
    const inv = Object.entries(s.inventory).filter(([, v]) => v).map(([k]) => k);
    if (ui.hudInv) ui.hudInv.textContent = inv.length ? inv.join(' · ') : '空';
    if (ui.hudVariant) {
      const tag =
        s.flags.useNight ? '夜' :
        (s.flags.livingClean || s.livingVariant === 'clean') ? '打扫后' : '';
      ui.hudVariant.hidden = !tag;
      ui.hudVariant.textContent = tag;
    }
    ui.debugPre.textContent = JSON.stringify(s, null, 2);
  }

  function spawnDanmaku(text) {
    if (!settings.danmaku || !ui.danmakuLayer || !text) return;
    const el = document.createElement('div');
    el.className = 'danmaku-line';
    el.textContent = text;
    el.style.top = `${12 + Math.random() * 42}%`;
    el.style.left = '100%';
    ui.danmakuLayer.appendChild(el);
    setTimeout(() => el.remove(), 7200);
  }

  function resolveBgKey(room, node) {
    if (!room) return null;
    const night = !!node?.night || !!store.data.flags.useNight;
    if (night && (room.variants?.night || room.bgNight)) {
      return room.variants?.night || room.bgNight;
    }
    if (store.data.flags.livingClean || store.data.livingVariant === 'clean') {
      if (room.variants?.clean) return room.variants.clean;
    }
    const want = store.data.livingVariant;
    if (want && room.variants?.[want]) return room.variants[want];
    return room.bg;
  }

  function resolveAllowRooms(node) {
    if (!node) return null;
    if (Array.isArray(node.allowRooms) && node.allowRooms.length) return node.allowRooms;
    if (node.unlockPreset && window.HH_UNLOCK_PRESETS?.[node.unlockPreset]) {
      return window.HH_UNLOCK_PRESETS[node.unlockPreset].slice();
    }
    return null;
  }

  function refreshSaveSlotList(mode = 'manage') {
    if (!ui.saveSlotList || !window.SaveSlots) return;
    ui.saveSlotList.innerHTML = '';
    SaveSlots.list().forEach((entry) => {
      const row = document.createElement('div');
      row.className = 'slot-row';
      const label = document.createElement('span');
      label.textContent = SaveSlots.formatMeta(entry);
      row.appendChild(label);
      if (mode === 'load' || mode === 'boot') {
        const loadBtn = document.createElement('button');
        loadBtn.textContent = '读取';
        loadBtn.disabled = !!entry.empty;
        loadBtn.onclick = () => {
          if (SaveSlots.loadFromSlot(entry.slot)) {
            ui.savePanel?.classList.remove('open');
            bootGame(true);
          } else toast('该槽位为空');
        };
        row.appendChild(loadBtn);
      }
      if (mode === 'manage' || mode === 'save') {
        const saveBtn = document.createElement('button');
        saveBtn.textContent = '写入';
        saveBtn.onclick = () => {
          store.data.savedAt = Date.now();
          SaveSlots.saveToSlot(entry.slot, store.data);
          toast(`已写入槽位 ${entry.slot}`);
          refreshSaveSlotList(mode);
        };
        row.appendChild(saveBtn);
      }
      ui.saveSlotList.appendChild(row);
    });
  }

  function openSavePanel(mode = 'manage') {
    if (!ui.savePanel) return;
    refreshSaveSlotList(mode);
    ui.savePanel.classList.add('open');
  }

  async function loadJson(path) {
    const res = await fetch(assetUrl(path));
    if (!res.ok) throw new Error(path);
    return res.json();
  }

  function setCharDisplay(img, height) {
    const h = height || 360;
    const scale = h / img.height;
    img.setDisplaySize(Math.max(40, Math.round(img.width * scale)), h);
  }

  class MainScene extends Phaser.Scene {
    constructor() {
      super('main');
    }

    preload() {
      // Day1 核心先装完再进游戏；拜访/异世界图延后静默预取
      const coreBgs = [
        'bg_xuanguan_day', 'bg_living_day', 'bg_living_night', 'bg_living_clean',
        'bg_kitchen_day', 'bg_bedroom_day', 'bg_bedroom_night', 'bg_bathroom',
      ];
      coreBgs.forEach((k) => this.load.image(k, assetUrl(`./assets/bg/${k}.png`)));

      const chars = [
        'ningnian_idle', 'ningnian_walk1', 'ningnian_walk2', 'ningnian_walk3', 'ningnian_walk4',
        'ningnian_walk5', 'ningnian_walk6',
        'sisi_idle', 'sisi_walk1', 'sisi_walk2', 'sisi_red_idle', 'sisi_hug',
        'boss_idle', 'boss_walk1', 'boss_walk2',
        'liuaiguo_idle', 'licuilan_idle',
      ];
      chars.forEach((k) => this.load.image(k, assetUrl(`./assets/char/${k}.png`)));

      ['mop', 'mop_blood', 'mop_used', 'towel', 'red_dress', 'meat_dish', 'blood_stain',
        'cucumber_mask', 'snakeskin_sack', 'cleaver', 'phone'].forEach((k) => {
        this.load.image(k, assetUrl(`./assets/prop/${k}.png`));
      });

      this.load.audio('door', assetUrl('./assets/audio/door.wav'));
      this.load.audio('ui_click', assetUrl('./assets/audio/ui_click.wav'));
      this.load.audio('sting_low', assetUrl('./assets/audio/sting_low.wav'));
      this.load.audio('pickup', assetUrl('./assets/audio/pickup.wav'));
      this.load.audio('step', assetUrl('./assets/audio/step.wav'));

      this.load.on('progress', (value) => {
        setLoadingProgress(0.12 + value * 0.86, '加载场景与角色…');
      });
      this.load.on('complete', () => {
        setLoadingProgress(0.98, '即将进入…');
      });
    }

    create() {
      ['door', 'ui_click', 'sting_low', 'pickup', 'step'].forEach((k) => {
        SFX[k] = new Audio(assetUrl(`./assets/audio/${k}.wav`));
      });

      this.worldWidth = 2560;
      this.playerCanMove = true;
      this.dialogueOpen = false;
      this.aiOpen = false;
      this.activeTarget = null;
      this.npcSprites = {};
      this.hotspotSprites = [];
      this.doorZones = [];
      this.lineQueue = [];
      this.pendingChoices = null;
      this.storyTriggerLock = false;
      this.approachDone = {};
      this.briefingDone = {};
      this._afterBriefing = null;
      this.walkFrame = 0;
      this.walkAcc = 0;
      this.stepAcc = 0;
      this.playerWalkKeys = [
        'ningnian_walk3',
        'ningnian_walk6',
        'ningnian_walk4',
        'ningnian_walk5',
      ];
      this.dimOverlay = null;
      this.chatHistory = { sisi: [], boss: [], liuaiguo: [], licuilan: [] };
      this._roomLoading = false;

      this.bg = this.add.image(0, 0, 'bg_xuanguan_day').setOrigin(0, 0);
      this.dimOverlay = this.add.rectangle(0, 0, 3000, 1200, 0x000000, 0).setOrigin(0, 0).setDepth(6);

      this.player = this.add.image(420, CFG.groundY, 'ningnian_idle').setOrigin(0.5, 1).setDepth(10);
      setCharDisplay(this.player, 360);

      this.keys = this.input.keyboard.addKeys({
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D,
        left2: Phaser.Input.Keyboard.KeyCodes.LEFT,
        right2: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      });

      this.cameras.main.setBounds(0, 0, this.worldWidth, CFG.designHeight);
      this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
      this.cameras.main.setFollowOffset(0, 100);

      this.loadRoom(store.data.roomId, store.data.playerX, false);
      this.applyNode(store.data.nodeId, true);
      refreshHud();
      setLoadingProgress(1, '完成');
      this.time.delayedCall(40, () => hideLoading());
      this.time.delayedCall(700, () => this.prefetchDeferredAssets());

      this.input.keyboard.on('keydown-E', () => {
        if (activeChoiceHandler) {
          activeChoiceHandler();
          return;
        }
        this.tryInteract();
      });
      this.input.keyboard.on('keydown-SPACE', () => {
        if (activeChoiceHandler) {
          activeChoiceHandler();
          return;
        }
        if (this.dialogueOpen && !this.aiOpen) this.advanceDialogue();
      });
      this.input.keyboard.on('keydown-C', () => this.openAiWithNearest());
      this.input.keyboard.on('keydown-ESC', () => {
        /* Esc 由 window 统一处理：面板层级 / 设置 */
      });
      this.input.keyboard.on('keydown-BACKTICK', () => ui.debug.classList.toggle('open'));

      this.input.once('pointerdown', () => {
        audioUnlocked = true;
        window.BgmPlayer?.unlock?.();
        window.BgmPlayer?.playForRoom?.(store.data.roomId, {
          night: !!nodes[store.data.nodeId]?.night || !!store.data.flags.useNight,
        });
      });
      this.time.addEvent({
        delay: 1000,
        loop: true,
        callback: () => {
          const hasBtn = ui.dlgChoices && ui.dlgChoices.children.length > 0;
          if (this.dialogueOpen && !hasBtn && !this.lineQueue.length && !this.aiOpen) {
            this.closePanels();
            this.playerCanMove = true;
            toast('对话异常已自动解锁移动');
          }
          setMoveHud(this);
        },
      });
    }

    prefetchDeferredAssets() {
      if (this._deferredQueued) return;
      this._deferredQueued = true;
      const deferredBgs = [
        'bg_living_dirty',
        'bg_corridor_visit', 'bg_otherworld_gates', 'bg_room_twins',
        'bg_room_cosplay', 'bg_floor10_bones', 'bg_room_mother_boy',
      ];
      deferredBgs.forEach((k) => {
        if (!this.textures.exists(k)) this.load.image(k, assetUrl(`./assets/bg/${k}.png`));
      });
      if (this.load.list.size > 0) this.load.start();
    }

    ensureBgTexture(bgKey) {
      if (!bgKey || this.textures.exists(bgKey)) return Promise.resolve(true);
      return new Promise((resolve) => {
        const startLoad = () => {
          if (this.textures.exists(bgKey)) {
            hideLoading();
            resolve(true);
            return;
          }
          showLoading('加载场景…');
          setLoadingProgress(0.2, '切换房间资源…');
          this.load.image(bgKey, assetUrl(`./assets/bg/${bgKey}.png`));
          const onDone = () => {
            this.load.off('complete', onDone);
            this.load.off('loaderror', onErr);
            setLoadingProgress(1, '完成');
            this.time.delayedCall(30, () => {
              hideLoading();
              resolve(this.textures.exists(bgKey));
            });
          };
          const onErr = () => {
            this.load.off('complete', onDone);
            this.load.off('loaderror', onErr);
            hideLoading();
            toast(`场景图缺失：${bgKey}`);
            resolve(false);
          };
          this.load.once('complete', onDone);
          this.load.once('loaderror', onErr);
          this.load.start();
        };
        if (this.load.isLoading()) {
          showLoading('加载场景…');
          this.load.once('complete', startLoad);
        } else {
          startLoad();
        }
      });
    }

    update(_, dt) {
      setMoveHud(this);
      if (!this.playerCanMove || this.dialogueOpen || this.aiOpen || store.data.flags.horrorDead || isSettingsOpen() || isCheatOpen()) {
        this.setPlayerIdle();
        clearMoveInputs();
        this.syncPrompt();
        this.syncGuide();
        return;
      }

      const speed = CFG.playerSpeed * (dt / 1000);
      let vx = 0;
      // 只用 window/触控状态，避免与 Phaser keyboard 双轨导致松手粘滞
      const left = moveKeys.left || hold.left;
      const right = moveKeys.right || hold.right;
      if (left) vx -= 1;
      if (right) vx += 1;

      if (vx !== 0) {
        this.player.x = Phaser.Math.Clamp(this.player.x + vx * speed, 120, this.worldWidth - 120);
        // 立绘默认朝左：向右走才镜像，避免月亮步
        this.player.setFlipX(vx > 0);
        store.data.playerX = this.player.x;
        this.walkAcc += dt;
        this.stepAcc += dt;
        const frameMs = 160;
        if (this.walkAcc >= frameMs) {
          const steps = Math.floor(this.walkAcc / frameMs);
          this.walkAcc -= steps * frameMs;
          const keys = this.playerWalkKeys || ['ningnian_walk1', 'ningnian_walk2'];
          this.walkFrame = (this.walkFrame + steps) % keys.length;
          const tex = keys[this.walkFrame];
          if (this.textures.exists(tex)) {
            this.player.setTexture(tex);
            setCharDisplay(this.player, 360);
          }
        }
        if (this.stepAcc > 220) {
          this.stepAcc = 0;
          playSfx('step', 0.15);
        }
      } else {
        this.walkAcc = 0;
        this.stepAcc = 0;
        this.setPlayerIdle();
      }

      this.syncPrompt();
      this.syncGuide();
      this.checkApproach();
      this.checkAutoStoryHotspot();
    }

    syncGuide() {
      const node = nodes[store.data.nodeId];
      if (!ui.guide || !ui.objective) return;
      if (this.dialogueOpen || this.aiOpen || !node?.guide || !this.playerCanMove) {
        ui.guide.classList.remove('open');
        if (node?.advanceHint) {
          ui.objective.textContent = node.advanceHint;
          ui.objective.classList.add('open');
        } else {
          ui.objective.classList.remove('open');
        }
        return;
      }
      if (node.advanceHint) {
        ui.objective.textContent = node.advanceHint;
        ui.objective.classList.add('open');
      }
      let tx = null;
      let label = node.guide.text || '这里';
      if (node.guide.type === 'door') {
        const door = this.doorZones.find((d) => d.id === node.guide.doorId) || this.doorZones[0];
        if (door) tx = door.x;
      } else if (node.guide.type === 'npc') {
        const npc = this.npcSprites[node.guide.npcId];
        if (npc) tx = npc.x;
      } else if (node.guide.type === 'hotspot') {
        const hs = this.hotspotSprites.find((h) => h.hotId === node.guide.hotspotId);
        if (hs) tx = hs.x;
        const hd = hs?.hotData || hotspots.find((h) => h.id === node.guide.hotspotId);
        if (hd?.type === 'observe_then_enter' && hd.peekFlag && store.data.flags[hd.peekFlag]) {
          label = `${hd.enterLabel || '进入'} · 按 E`;
          ui.objective.textContent = `目标：按 E ${hd.enterLabel || '进入'}`;
          ui.objective.classList.add('open');
        }
      }
      if (tx == null) {
        ui.guide.classList.remove('open');
        return;
      }
      const host = document.getElementById('stage') || ui.guide.parentElement;
      const cam = this.cameras.main;
      const x = (tx - cam.scrollX) * (host.clientWidth / CFG.designWidth);
      const y = (CFG.groundY - 420 - cam.scrollY) * (host.clientHeight / CFG.designHeight);
      ui.guide.textContent = label;
      ui.guide.style.left = `${x}px`;
      ui.guide.style.top = `${y}px`;
      ui.guide.classList.add('open');
    }

    setPlayerIdle() {
      if (this.player.texture.key !== 'ningnian_idle') {
        this.player.setTexture('ningnian_idle');
        setCharDisplay(this.player, 360);
      }
    }

    syncPrompt() {
      const target = this.findNearestTarget();
      this.activeTarget = target;
      if (!target || this.dialogueOpen || this.aiOpen) {
        ui.prompt.classList.remove('open');
        ui.prompt.style.display = 'none';
        return;
      }
      const host = document.getElementById('stage') || ui.prompt.parentElement;
      const cam = this.cameras.main;
      const x = (target.x - cam.scrollX) * (host.clientWidth / CFG.designWidth);
      const onFloor = !!(target.floorDecal || target.data?.floorDecal);
      // 地面贴纸把 E 提示压到脚边；角色/门仍抬高一点
      const lift = onFloor ? 56 : 400;
      const y = (CFG.groundY - lift - cam.scrollY) * (host.clientHeight / CFG.designHeight);
      ui.prompt.classList.add('open');
      ui.prompt.style.display = 'block';
      ui.prompt.style.left = `${x}px`;
      ui.prompt.style.top = `${y}px`;
      ui.prompt.style.transform = onFloor ? 'translate(-50%, -20%)' : 'translate(-50%, -120%)';
      ui.prompt.textContent = target.label || 'E 互动';
    }

    findNearestTarget() {
      const px = this.player.x;
      let best = null;
      let bestDist = CFG.interactRange;

      Object.values(this.npcSprites).forEach((npc) => {
        if (!npc.visible) return;
        const d = Math.abs(npc.x - px);
        if (d < bestDist) {
          bestDist = d;
          best = { type: 'npc', id: npc.npcId, x: npc.x, label: `E 交谈·${npc.displayName}` };
        }
      });

      this.hotspotSprites.forEach((h) => {
        if (!h.visible) return;
        const d = Math.abs(h.x - px);
        if (d < bestDist) {
          bestDist = d;
          const hd = h.hotData;
          let label = h.label;
          if (hd?.type === 'observe_then_enter') {
            const peeked = !!(hd.peekFlag && store.data.flags[hd.peekFlag]);
            label = peeked ? (hd.enterLabel || '进入') : (hd.label || h.label);
          }
          best = {
            type: 'hotspot',
            id: h.hotId,
            x: h.x,
            label: `E ${label}`,
            data: hd,
            floorDecal: !!hd?.floorDecal,
          };
        }
      });

      const node = nodes[store.data.nodeId];
      if (!store.data.flags.doorsLocked) {
        const allowed = resolveAllowRooms(node);
        this.doorZones.forEach((d) => {
          // 被 observe_then_enter 热点接管的门：不单独显示右侧交互
          if (this.isDoorMergedIntoHotspot(d.id)) return;
          if (allowed) {
            const dest = d.target;
            if (dest && dest !== store.data.roomId && !allowed.includes(dest)) return;
          }
          const dlt = Math.abs(d.x - px);
          if (dlt < bestDist) {
            bestDist = dlt;
            best = { type: 'door', id: d.id, x: d.x, label: `E ${d.label}`, data: d };
          }
        });
      }
      return best;
    }

    isDoorMergedIntoHotspot(doorId) {
      return hotspots.some(
        (h) =>
          h.type === 'observe_then_enter' &&
          h.enterDoorId === doorId &&
          h.room === store.data.roomId &&
          this.hotspotAllowed(h)
      );
    }

    tryInteract() {
      if (activeChoiceHandler) {
        activeChoiceHandler();
        return;
      }
      if (this.dialogueOpen && !this.aiOpen) {
        this.advanceDialogue();
        return;
      }
      if (this.aiOpen) return;
      const t = this.activeTarget || this.findNearestTarget();
      if (!t) return;
      if (t.type === 'door') this.useDoor(t.data);
      else if (t.type === 'hotspot') this.useHotspot(t.data || hotspots.find((h) => h.id === t.id));
      else if (t.type === 'npc') this.talkNpc(t.id);
    }

    talkNpc(npcId) {
      playSfx('ui_click', 0.2);
      this.openAiChat(npcId);
    }

    openAiWithNearest() {
      const t = this.findNearestTarget();
      if (t?.type === 'npc') this.openAiChat(t.id);
      else toast('靠近 NPC 再按 C');
    }

    async openAiChat(npcId) {
      const meta = npcsData[npcId];
      if (!meta) return;
      this.aiOpen = true;
      this.dialogueOpen = true;
      this.playerCanMove = false;
      this.openDialogueUi();
      ui.aiRow.classList.add('open');
      ui.dlgChoices.innerHTML = '';
      ui.dlgName.textContent = meta.displayName;
      ui.dlgText.textContent = ai.hasKey()
        ? '你可以直接说话。回车发送。'
        : '未检测到 API 密钥，将使用角色兜底短句。仍可输入试玩。';
      window.PortraitUI?.show?.(npcId, {});
      ui.aiInput.value = '';
      ui.aiInput.focus();
      this.aiTarget = npcId;
      const node = nodes[store.data.nodeId];
      if (node?.aiStage) ai.setStage(node.aiStage);
    }

    async sendAi() {
      const text = ui.aiInput.value.trim();
      if (!text || !this.aiTarget) return;
      ui.dlgText.textContent = '……';
      playSfx('ui_click', 0.15);
      const result = await ai.chat(this.aiTarget, text, this.chatHistory[this.aiTarget]);
      this.chatHistory[this.aiTarget].push({ role: 'user', content: text });
      this.chatHistory[this.aiTarget].push({ role: 'assistant', content: result.text });
      ui.dlgName.textContent = npcsData[this.aiTarget].displayName;
      ui.dlgText.textContent = result.text;
      store.data.npcChatState[this.aiTarget] = store.data.npcChatState[this.aiTarget] || {};
      store.data.npcChatState[this.aiTarget].met = true;
      store.data.npcChatState[this.aiTarget].lastTopic = text.slice(0, 40);
      store.save();
      refreshHud();
      ui.aiInput.value = '';
      if (!result.ok) toast(result.reason === 'no_key' ? 'API 占位中（无密钥兜底）' : `API：${result.reason}`);
    }

    openDialogueUi() {
      ui.dialogue.classList.add('open');
      ui.dialogue.style.display = 'block';
      ui.aiRow.classList.remove('open');
      this.setWorldActorsHidden(true);
      const panel = document.getElementById('dlg-panel');
      if (panel && !panel._hhClickBound) {
        panel._hhClickBound = true;
        panel.addEventListener('click', (e) => {
          if (e.target.closest('button, input, a, .dlg-toolbar')) return;
          if (activeChoiceHandler) activeChoiceHandler();
        });
      }
    }

    setWorldActorsHidden(hidden) {
      if (this.player) this.player.setVisible(!hidden);
      Object.values(this.npcSprites || {}).forEach((n) => n.setVisible(!hidden));
    }

    closePanels() {
      this.dialogueOpen = false;
      this.aiOpen = false;
      this.playerCanMove = true;
      activeChoiceHandler = null;
      ui.dialogue.classList.remove('open');
      ui.dialogue.style.display = 'none';
      ui.aiRow.classList.remove('open');
      const panel = document.getElementById('dlg-panel');
      panel?.classList.remove('is-system');
      const hint = document.getElementById('dlg-hint');
      if (hint) hint.style.display = '';
      window.PortraitUI?.hide?.();
      this.setWorldActorsHidden(false);
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      this.syncGuide();
      setMoveHud(this);
    }

    loadRoom(roomId, x, fade = true) {
      const room = rooms[roomId];
      if (!room) return;
      if (this._roomLoading) return;
      const node = nodes[store.data.nodeId] || {};
      const bgKey = resolveBgKey(room, node);

      const apply = () => {
        store.data.roomId = roomId;
        this.worldWidth = room.width || 2560;
        this.cameras.main.setBounds(0, 0, this.worldWidth, CFG.designHeight);
        if (bgKey && this.textures.exists(bgKey)) this.bg.setTexture(bgKey);
        this.bg.setDisplaySize(this.worldWidth, CFG.designHeight);
        this.dimOverlay.setSize(this.worldWidth + 200, CFG.designHeight + 200);
        this.player.x = x ?? room.spawnX;
        this.player.y = CFG.groundY;
        store.data.playerX = this.player.x;
        this.rebuildDoors(room);
        this.rebuildHotspots(roomId);
        this.rebuildNpcs();
        this.applyDim();
        store.save();
        refreshHud();
        window.BgmPlayer?.playForRoom?.(roomId, {
          night: !!node.night || !!store.data.flags.useNight,
        });
      };

      const run = () => {
        if (fade) {
          playSfx('door', 0.35);
          this.cameras.main.fadeOut(160, 0, 0, 0);
          this.cameras.main.once('camerafadeoutcomplete', () => {
            apply();
            this.cameras.main.fadeIn(160, 0, 0, 0);
          });
        } else apply();
      };

      if (bgKey && !this.textures.exists(bgKey)) {
        this._roomLoading = true;
        this.ensureBgTexture(bgKey).finally(() => {
          this._roomLoading = false;
          run();
        });
        return;
      }
      run();
    }

    applyDim() {
      const a = store.data.flags.lightsDim ? 0.35 : 0;
      this.dimOverlay.setFillStyle(0x000000, a);
    }

    rebuildDoors(room) {
      this.doorZones = (room.doors || []).map((d) => ({ ...d }));
    }

    hotspotAllowed(h) {
      if (h.inventory && store.data.inventory[h.inventory]) return false;
      if (h.nodes && h.nodes.length && !h.nodes.includes(store.data.nodeId)) return false;
      return true;
    }

    rebuildHotspots(roomId) {
      this.hotspotSprites.forEach((s) => {
        try { s.destroy(); } catch (_) { try { s.destroy(false); } catch (__) {} }
      });
      this.hotspotSprites = [];
      hotspots.filter((h) => h.room === roomId && this.hotspotAllowed(h)).forEach((h) => {
        let sprite;
        if (h.prop && this.textures.exists(h.prop)) {
          if (h.floorDecal) {
            // 地面贴纸：贴在脚底线附近，压扁、低深度，避免竖着像道具
            sprite = this.add.image(h.x, CFG.groundY - 6, h.prop).setOrigin(0.5, 1);
            sprite.setDisplaySize(h.displayW || 220, h.displayH || 90);
            sprite.setAlpha(h.alpha != null ? h.alpha : 0.88);
            sprite.setDepth(3);
          } else {
            sprite = this.add.image(h.x, CFG.groundY - 10, h.prop).setOrigin(0.5, 1);
            sprite.setDisplaySize(h.displayW || 100, h.displayH || 100);
            sprite.setDepth(5);
          }
        } else {
          // 无道具图：不可见碰撞点（靠近才出 E 提示）
          sprite = this.add.circle(h.x, CFG.groundY - 28, 18, 0x8eb6d8, 0);
          sprite.setDepth(5);
        }
        sprite.hotId = h.id;
        sprite.label = h.label;
        sprite.hotData = h; // 勿写 sprite.data：会覆盖 Phaser DataManager，destroy 时崩溃
        this.hotspotSprites.push(sprite);
      });
    }

    rebuildNpcs() {
      Object.values(this.npcSprites).forEach((s) => s.destroy());
      this.npcSprites = {};
      const node = nodes[store.data.nodeId] || {};
      (node.showNpcs || []).forEach((id) => {
        const meta = npcsData[id];
        if (!meta) return;
        const pose = node.npcPose?.[id] || {};
        const key = pose.sprite || meta.idle;
        if (!this.textures.exists(key)) return;
        const npc = this.add.image(pose.x || 1200, CFG.groundY, key).setOrigin(0.5, 1);
        setCharDisplay(npc, meta.height || 360);
        npc.npcId = id;
        npc.displayName = meta.displayName;
        npc.setDepth(8);
        this.npcSprites[id] = npc;

        if (pose.walkTo != null) {
          const walkKeys = meta.walk || [meta.idle];
          let fi = 0;
          npc.setFlipX(pose.walkTo > npc.x); // 立绘默认朝左
          const tw = this.tweens.add({
            targets: npc,
            x: pose.walkTo,
            duration: 1700,
            ease: 'Sine.easeInOut',
            onUpdate: () => {
                if (pose.walkAnim && walkKeys.length) {
                  fi += 1;
                  if (fi % 8 === 0) {
                    const idx = ((fi / 8) | 0) % walkKeys.length;
                    if (this.textures.exists(walkKeys[idx])) npc.setTexture(walkKeys[idx]);
                  }
                  setCharDisplay(npc, meta.height || 360);
                }
            },
            onComplete: () => {
              npc.setTexture(meta.idle);
              setCharDisplay(npc, meta.height || 360);
            },
          });
          npc._walkTween = tw;
        }
      });
    }

    useDoor(door) {
      if (store.data.flags.horrorDead) {
        toast('惊悚值已满，角色已死亡');
        return;
      }
      if (store.data.flags.doorsLocked) {
        toast('现在走不开……');
        return;
      }
      const node = nodes[store.data.nodeId];
      const allowed = resolveAllowRooms(node);
      if (allowed) {
        const dest = door.target;
        if (dest !== store.data.roomId && !allowed.includes(dest)) {
          toast('现在先别乱跑……');
          return;
        }
      }
      if (node?.nextOnDoor?.[door.id]) {
        const dest = node.nextOnDoor[door.id];
        if (dest === '__VISIT_HOME__') {
          this.dialogueOpen = true;
          this.playerCanMove = false;
          this.openDialogueUi();
          ui.dlgName.textContent = '系统';
          ui.dlgName.className = 'dlg-name system';
          ui.dlgText.textContent = '是否结束拜访，回 30 层？';
          this.showChoices([
            { text: '回 30 层', effects: { floor: 30 }, next: resolveVisitHomeNode(node) },
            { text: '再逛逛', unlockMove: true, next: null },
          ]);
          return;
        }
        this.applyNode(dest);
        return;
      }
      this.loadRoom(door.target, door.targetX, true);
    }

    useHotspot(h) {
      if (!h) return;
      if (store.data.flags.horrorDead) {
        toast('惊悚值已满，角色已死亡');
        return;
      }
      if (h.type === 'open_floor_bar') {
        playSfx('ui_click', 0.2);
        openFloorBar();
        return;
      }
      if (h.type === 'visit_floor') {
        const floor = String(h.floor || '');
        const info = visitFloors[floor];
        if (!info) {
          toast('这扇门打不开');
          return;
        }
        const day = Number(store.data.day) || 1;
        if ((Number(info.dayMin) || 1) > day) {
          this.showSimple(h.label, '按钮还是灰的。更低的层明天再试。');
          return;
        }
        playSfx('ui_click', 0.2);
        startVisitFloor(floor);
        return;
      }
      if (h.type === 'pickup') {
        if (h.inventory) store.data.inventory[h.inventory] = true;
        if (h.trust) {
          Object.entries(h.trust).forEach(([k, v]) => {
            store.data.familyTrust[k] = (store.data.familyTrust[k] || 0) + v;
          });
        }
        if (h.livingVariant) {
          store.applyEffects({ livingVariant: h.livingVariant });
          const room = rooms[store.data.roomId];
          const bgKey = resolveBgKey(room, nodes[store.data.nodeId]);
          if (bgKey && this.textures.exists(bgKey)) {
            this.bg.setTexture(bgKey);
            this.bg.setDisplaySize(this.worldWidth, CFG.designHeight);
          }
        }
        if (h.horror) {
          store.setHorror(h.horror, {
            relative: true,
            reason: h.horrorReason || `拾取「${h.label}」`,
            source: 'hotspot',
          });
        }
        store.save();
        playSfx('pickup');
        this.showSimple(h.label, h.text, () => this.rebuildHotspots(store.data.roomId));
        refreshHud();
        return;
      }
      if (h.type === 'observe' || h.type === 'observe_then_enter') {
        if (h.type === 'observe_then_enter') {
          const peeked = !!(h.peekFlag && store.data.flags[h.peekFlag]);
          if (peeked) {
            const room = rooms[store.data.roomId];
            const door = (room?.doors || []).find((d) => d.id === h.enterDoorId);
            if (door) this.useDoor(door);
            else toast('门打不开……');
            return;
          }
          if (h.peekFlag) store.data.flags[h.peekFlag] = true;
        }
        if (h.clue) store.data.clues[h.clue] = true;
        if (h.horror) {
          store.setHorror(h.horror, {
            relative: true,
            reason: h.horrorReason || `观察「${h.label}」`,
            source: 'hotspot',
          });
        }
        store.save();
        playSfx('ui_click', 0.2);
        this.showSimple(h.label, h.text, () => {
          if (h.type === 'observe_then_enter') {
            const hs = this.hotspotSprites.find((s) => s.hotId === h.id);
            if (hs) hs.label = h.enterLabel || '进入';
            this.syncGuide();
            this.syncPrompt();
          }
        });
        refreshHud();
        return;
      }
      if (h.type === 'toggle_light') {
        store.data.flags.lightsDim = !store.data.flags.lightsDim;
        store.save();
        this.applyDim();
        playSfx('ui_click');
        this.showSimple(h.label, store.data.flags.lightsDim ? '灯暗了一点。' : '灯亮了一点。');
        return;
      }
      if (h.type === 'story') {
        const node = nodes[store.data.nodeId];
        if (node?.storyHotspot === h.id && node.storyNext) {
          if (this._storyDefer) delete this._storyDefer[node.id];
          this.requestStoryResume(node);
          return;
        }
        this.showSimple(h.label, h.text);
      }
    }

    requestStoryResume(node) {
      if (!node?.storyNext) return;
      if (!node.storyConfirm) {
        this.applyNode(node.storyNext);
        return;
      }
      this.dialogueOpen = true;
      this.playerCanMove = false;
      this.openDialogueUi();
      ui.dlgName.textContent = '系统';
      ui.dlgName.className = 'dlg-name system';
      ui.dlgText.textContent = node.storyConfirm;
      window.DialogueShell?.push?.('系统', node.storyConfirm);
      this.showChoices([
        {
          text: '继续主线',
          next: node.storyNext,
          effects: {},
        },
        {
          text: '再逛逛',
          unlockMove: true,
          next: null,
          _deferStory: node.id,
        },
      ]);
      setMoveHud(this);
    }

    checkApproach() {
      const node = nodes[store.data.nodeId];
      if (!node?.approachTrigger || this.approachDone[node.id]) return;
      if (this.dialogueOpen || this.aiOpen) return;
      const tr = node.approachTrigger;
      const npc = this.npcSprites[tr.npc];
      if (!npc) return;
      if (Math.abs(this.player.x - npc.x) <= (tr.range || 160)) {
        this.approachDone[node.id] = true;
        this.triggerApproach(node);
      }
    }

    triggerApproach(node) {
      const pack = node.onApproach;
      if (!pack) return;
      if (pack.sound) playSfx(pack.sound, 0.5);
      const sisi = this.npcSprites.sisi;
      if (pack.anim === 'hug' && sisi && this.textures.exists('sisi_hug')) {
        sisi.setTexture('sisi_hug');
        setCharDisplay(sisi, npcsData.sisi.height);
        this.tweens.add({
          targets: sisi,
          // flipX=true 表示朝右（默认立绘朝左）
          x: this.player.x + (this.player.flipX ? 40 : -40),
          duration: 450,
          ease: 'Quad.easeOut',
        });
      }
      this.playerCanMove = false;
      this.lineQueue = filterByWhen(pack.dialogue || []).map((l) => ({ ...l }));
      this.pendingChoices = filterByWhen(pack.choices || []);
      this.dialogueOpen = true;
      this.openDialogueUi();
      ui.dlgChoices.innerHTML = '';
      this.advanceDialogue();
    }

    checkAutoStoryHotspot() {
      const node = nodes[store.data.nodeId];
      if (!node?.storyHotspot || node.autoDialogue || this.storyTriggerLock) return;
      if (this.dialogueOpen || this.aiOpen) return;
      if (this._storyDefer?.[node.id]) return;
      const h = hotspots.find((x) => x.id === node.storyHotspot);
      if (!h || h.room !== store.data.roomId) return;
      if (Math.abs(this.player.x - h.x) < 100) {
        this.storyTriggerLock = true;
        this.requestStoryResume(node);
        this.time.delayedCall(900, () => { this.storyTriggerLock = false; });
      }
    }

    showSimple(name, text, onClose) {
      this.dialogueOpen = true;
      this.playerCanMove = false;
      this.openDialogueUi();
      ui.dlgName.textContent = name;
      ui.dlgText.textContent = text;
      window.PortraitUI?.hide?.();
      ui.dlgChoices.innerHTML = '';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = '继续（或按空格）';
      const go = () => {
        playSfx('ui_click', 0.2);
        this.closePanels();
        if (onClose) onClose();
      };
      btn.onclick = go;
      activeChoiceHandler = go;
      ui.dlgChoices.appendChild(btn);
    }

    applyNode(nodeId, fromBoot = false) {
      const node = nodes[nodeId];
      if (!node) return;
      store.data.nodeId = nodeId;
      if (node.onEnter) {
        const enter = { ...node.onEnter };
        if (enter.horror != null) {
          store.setHorror(enter.horror, {
            relative: false,
            reason: enter.horrorReason || `进入节点 ${nodeId}`,
            source: 'onEnter',
          });
          delete enter.horror;
          delete enter.horrorReason;
        }
        Object.assign(store.data, enter);
      }
      store.data.flags.doorsLocked = !!node.lockDoors;
      if (node.night === true) store.data.flags.useNight = true;
      if (node.night === false) store.data.flags.useNight = false;
      if (node.floorBar) {
        store.data.visitReturnNode = node.id;
      }
      if (node.aiStage) ai.setStage(node.aiStage);
      if (node.exploreHint && !store.data.flags.freeGateToast) {
        store.data.flags.freeGateToast = node.id === 'FREE_D1';
        toast(node.exploreHint);
      } else if (node.exploreHint && node.id !== 'FREE_D1') {
        toast(node.exploreHint);
      }
      window.DialogueShell?.resetSession?.();
      store.save();

      if (node.sound) playSfx(node.sound, 0.5);
      if (nodeId === 'D1-03') {
        this.cameras.main.shake(420, 0.004);
        window.BgmPlayer?.playMood?.('tension');
      }
      if (nodeId === 'D1-05' || node?.night) {
        window.BgmPlayer?.playMood?.('night');
      }

      const after = () => {
        if (node.spawnPlayerX != null) {
          this.player.x = node.spawnPlayerX;
          store.data.playerX = this.player.x;
        }
        this.rebuildNpcs();
        this.rebuildHotspots(store.data.roomId);
        this.applyDim();
        refreshHud();

        if (node.briefing && !this.briefingDone?.[node.id]) {
          this.briefingDone = this.briefingDone || {};
          this.briefingDone[node.id] = true;
          this.playBriefing(node, () => this.continueNodeContent(node, fromBoot));
          return;
        }
        this.continueNodeContent(node, fromBoot);
      };

      const needRoom = node.room && node.room !== store.data.roomId;
      if (needRoom) {
        this.loadRoom(node.room, node.spawnPlayerX ?? rooms[node.room].spawnX, !fromBoot);
        this.time.delayedCall(fromBoot ? 50 : 420, after);
      } else {
        const room = rooms[store.data.roomId];
        if (room) {
          const bgKey = resolveBgKey(room, node);
          if (bgKey && this.textures.exists(bgKey) && this.bg.texture.key !== bgKey) this.bg.setTexture(bgKey);
          this.bg.setDisplaySize(this.worldWidth, CFG.designHeight);
        }
        after();
      }
    }

    playBriefing(node, thenFn) {
      this._afterBriefing = thenFn;
      this.lineQueue = filterByWhen(node.briefing || []).map((l) => ({ ...l }));
      this.pendingChoices = [
        node.briefingChoice || { text: '继续', next: null, _briefingContinue: true },
      ];
      // mark briefing continue specially
      this.pendingChoices[0]._briefingContinue = true;
      this.dialogueOpen = true;
      this.playerCanMove = false;
      this.openDialogueUi();
      ui.dlgChoices.innerHTML = '';
      if (!this.lineQueue.length) this.showChoices(this.pendingChoices);
      else this.advanceDialogue();
    }

    continueNodeContent(node, fromBoot = false) {
      if (node.autoDialogue) {
        this.startNodeDialogue(node);
      } else if (node.intro && (fromBoot || node.id === 'P04' || node.choices)) {
        this.lineQueue = filterByWhen(node.intro || []).map((l) => ({ ...l }));
        this.pendingChoices = filterByWhen(node.choices || [{ text: '开始走动', unlockMove: true, next: null }]);
        this.dialogueOpen = true;
        this.playerCanMove = false;
        this.openDialogueUi();
        this.advanceDialogue();
        // 若仍没有内容，强制兜底旁白
        if (!ui.dlgText.textContent) {
          ui.dlgName.textContent = '旁白';
          ui.dlgText.textContent = '欢迎进入幸福之家。按空格继续。';
        }
      } else if (node.approachTrigger) {
        toast(node.advanceHint || '靠近目标…');
        this.playerCanMove = true;
      }
      if (node.ending && node.id === 'END_DAY1') {
        store.data.flags.day1_cleared = true;
        store.save();
      }
      this.syncGuide();
      setMoveHud(this);
    }

    startNodeDialogue(node) {
      this.lineQueue = filterByWhen(node.dialogue || []).map((l) => ({ ...l }));
      this.pendingChoices = filterByWhen(node.choices || []);
      this.dialogueOpen = true;
      this.playerCanMove = false;
      this.openDialogueUi();
      ui.dlgChoices.innerHTML = '';
      if (!this.lineQueue.length) this.showChoices(this.pendingChoices);
      else this.advanceDialogue();
    }

    advanceDialogue() {
      if (!this.dialogueOpen || this.aiOpen) return;
      activeChoiceHandler = null;
      if (!this.lineQueue.length) {
        if (this.pendingChoices) this.showChoices(this.pendingChoices);
        else this.closePanels();
        return;
      }
      const line = this.lineQueue.shift();
      const speaker = line.speaker || '旁白';

      if (speaker === 'danmaku' || line.type === 'danmaku') {
        spawnDanmaku(line.text);
        window.DialogueShell?.push?.('弹幕', line.text);
        applyLineHorror(line);
        refreshHud();
        this.advanceDialogue();
        return;
      }

      const nameMap = {
        system: '系统', 旁白: '旁白', sisi: '秦思思', boss: '？？？',
        liuaiguo: '刘爱国', licuilan: '李翠兰',
        红姐: '红姐', 俊哥: '俊哥', 苏小茉: '苏小茉', 方远: '方远',
        邻家: '邻家', '？': '？',
      };
      const display = nameMap[speaker] || speaker;
      ui.dlgName.textContent = display;
      ui.dlgName.className = 'dlg-name' + (speaker === 'system' ? ' system' : speaker === 'danmaku' ? ' danmaku' : '');
      const panel = document.getElementById('dlg-panel');
      panel?.classList.toggle('is-system', speaker === 'system' || speaker === '旁白');
      ui.dlgText.textContent = line.text;
      window.DialogueShell?.push?.(display, line.text);
      window.PortraitUI?.show?.(speaker, line);
      const hint = document.getElementById('dlg-hint');
      if (hint) hint.style.display = '';
      applyLineHorror(line);
      refreshHud();
      ui.dlgChoices.innerHTML = '';
      playSfx('ui_click', 0.12);
      window.DialogueShell?.onLineShown?.();

      if (!this.lineQueue.length && this.pendingChoices) {
        if (hint) hint.style.display = 'none';
        this.showChoices(this.pendingChoices);
      } else {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = this.lineQueue.length ? '继续' : '…';
        const go = () => this.advanceDialogue();
        btn.onclick = go;
        activeChoiceHandler = go;
        ui.dlgChoices.appendChild(btn);
      }
    }

    showChoices(choices) {
      ui.dlgChoices.innerHTML = '';
      activeChoiceHandler = null;
      const list = filterByWhen(choices || []);
      if (!list.length) {
        this.closePanels();
        return;
      }
      const handlers = [];
      list.forEach((c, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = c.text + (idx === 0 ? '（回车）' : '');
        const activate = () => {
          playSfx('ui_click', 0.25);
          store.applyEffects(c.effects || {});
          if (c.text.includes('毛巾') && store.data.inventory.towel) {
            store.data.familyTrust.sisi += 1;
            store.save();
          }
          refreshHud();
          activeChoiceHandler = null;
          this.closePanels();

          if (c._briefingContinue) {
            this.playerCanMove = !!c.unlockMove || this.playerCanMove;
            if (c.unlockMove) {
              toast('看顶部目标，用 A/D 或 ←→ 移动');
              showControlHint();
            }
            const fn = this._afterBriefing;
            this._afterBriefing = null;
            // 若后续不是立刻再锁对话，保持可移动
            if (fn) fn();
            if (c.unlockMove && !this.dialogueOpen) this.playerCanMove = true;
            this.syncGuide();
            setMoveHud(this);
            return;
          }
          if (c.effects?.reset) {
            location.reload();
            return;
          }
          if (c.unlockMove) {
            this.playerCanMove = true;
            this.dialogueOpen = false;
            ui.dialogue.classList.remove('open');
            ui.dialogue.style.display = 'none';
            if (c._deferStory) {
              this._storyDefer = this._storyDefer || {};
              this._storyDefer[c._deferStory] = true;
              toast('稍后再靠近，或按 E 点餐桌/床继续');
            } else {
              toast('已解锁移动：A/D 或 ←→，走到门按 E');
            }
            showControlHint();
            this.syncGuide();
            setMoveHud(this);
            return;
          }
          if (c.showEnd || c.effects?.['flags.day1_cleared']) {
            store.data.flags.doorsLocked = false;
            if (c.effects?.['flags.day1_cleared']) store.data.flags.day1_cleared = true;
            store.save();
            refreshHud();
            const curNode = nodes[store.data.nodeId] || {};
            window.__hhEndNext = c.next || curNode.endNext || null;
            const titleEl = document.getElementById('end-title');
            const descEl = document.getElementById('end-desc');
            if (titleEl) titleEl.textContent = curNode.endTitle || curNode.title || '本日结算';
            if (descEl) descEl.textContent = curNode.endDesc || '可在设置里写入多槽存档。';
            const nextBtn = document.getElementById('end-nextday');
            if (nextBtn) {
              nextBtn.hidden = !window.__hhEndNext;
              if (!window.__hhEndNext) nextBtn.textContent = '已结束';
              else if (String(window.__hhEndNext).startsWith('END_') || String(window.__hhEndNext).startsWith('D7')) {
                nextBtn.textContent = '继续';
              } else nextBtn.textContent = '进入下一天';
            }
            const stats = document.getElementById('end-stats');
            if (stats) {
              const h = store.data.horror ?? 0;
              const band = StateStore.horrorBand(h);
              const pts = StateStore.clearPoints(h);
              stats.textContent =
                `惊悚 ${h}（${band.label}）· 若按原书结算约 ${pts} 积分 · 拜访卡 ${store.data.visitCards || 0} · 信任 思思 ${store.data.familyTrust.sisi} / Boss ${store.data.familyTrust.boss} · 背包 ${Object.entries(store.data.inventory).filter(([,v])=>v).map(([k])=>k).join(',') || '空'}`;
            }
            ui.endCard.classList.add('open');
            return;
          }
          if (c.returnVisit) {
            const back = store.data.visitReturnNode
              || (store.data.day >= 5 ? 'FREE_VISIT_D5' : 'FREE_VISIT_D4');
            this.applyNode(back);
            return;
          }
          if (c.next) this.applyNode(c.next);
        };
        btn.onclick = activate;
        handlers.push({ c, activate });
        ui.dlgChoices.appendChild(btn);
      });
      const prefer = handlers.find((h) => h.c.unlockMove) || handlers[0];
      activeChoiceHandler = prefer.activate;
    }
  }

  async function bootGame(continueSave) {
    try {
      if (window.__hhGame) {
        window.__hhGame.destroy(true);
        window.__hhGame = null;
      }

      showLoading('读取剧本…');
      setLoadingProgress(0.02, '读取剧本…');
      ui.boot.classList.remove('show');
      ui.boot.style.display = 'none';

      rooms = await loadJson('./data/rooms.json');
      setLoadingProgress(0.04, '读取节点…');
      nodes = {};
      const nodeFiles = [
        'day1.nodes.json', 'day2.nodes.json', 'day3.nodes.json',
        'day4.nodes.json', 'day5.nodes.json', 'day6.nodes.json',
        'day7.nodes.json', 'visit.nodes.json',
      ];
      for (let i = 0; i < nodeFiles.length; i++) {
        Object.assign(nodes, await loadJson(`./data/${nodeFiles[i]}`));
        setLoadingProgress(0.04 + ((i + 1) / nodeFiles.length) * 0.06, `读取节点 ${i + 1}/${nodeFiles.length}…`);
      }
      npcsData = await loadJson('./data/npcs.json');
      hotspots = await loadJson('./data/hotspots.json');
      visitFloors = await loadJson('./data/visit_floors.json');
      prompts = await loadJson('./prompts/npc_stages.json');
      ai = new AiNpcClient(CFG, prompts);
      setLoadingProgress(0.12, '准备引擎…');

      if (continueSave) {
        if (!store.load()) toast('没有存档，开始新游戏');
      } else store.reset();

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: 'game-canvas',
        width: CFG.designWidth,
        height: CFG.designHeight,
        backgroundColor: '#000000',
        audio: { disableWebAudio: false },
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
          parent: 'game-canvas',
        },
        scene: [MainScene],
      });
      window.__hhGame = game;
      window.__hhStore = store;
      window.__hhApplyNode = (id) => {
        if (window.__hhCheatJump) window.__hhCheatJump(id);
        else game.scene.getScene('main')?.applyNode(id);
      };

      game.events.once('ready', () => {
        setTimeout(() => {
          const scene = game.scene.getScene('main');
          if (!scene) return;
          if (!ui.dialogue.classList.contains('open') && store.data.nodeId === 'P04') {
            scene.applyNode('P04', true);
          }
          setMoveHud(scene);
        }, 400);
      });

      if (!ai.hasKey()) toast('API 密钥未灌入：AI 走兜底短句');
    } catch (err) {
      console.error(err);
      hideLoading();
      alert('游戏启动失败：' + (err && err.message ? err.message : err) + '\n请用本地 serve 打开，不要用 file://');
      ui.boot.classList.add('show');
      ui.boot.style.display = 'grid';
    }
  }

  document.getElementById('btn-new').onclick = () => {
    window.BgmPlayer?.unlock?.();
    bootGame(false);
  };
  document.getElementById('btn-continue').onclick = () => {
    window.BgmPlayer?.unlock?.();
    bootGame(true);
  };
  const btnSlots = document.getElementById('btn-slots');
  if (btnSlots) {
    btnSlots.onclick = () => {
      openSavePanel('boot');
    };
  }
  document.getElementById('ai-send').onclick = () => window.__hhGame?.scene.getScene('main')?.sendAi();
  document.getElementById('ai-close').onclick = () => window.__hhGame?.scene.getScene('main')?.closePanels();
  document.getElementById('ai-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('ai-send').click();
    }
  });
  document.getElementById('end-restart').onclick = () => { store.reset(); location.reload(); };
  document.getElementById('end-nextday')?.addEventListener('click', () => {
    const next = window.__hhEndNext;
    ui.endCard.classList.remove('open');
    const scene = window.__hhGame?.scene.getScene('main');
    if (next && scene) {
      store.data.flags.doorsLocked = false;
      store.save();
      scene.closePanels();
      scene.applyNode(next);
      toast(String(next).startsWith('END_') ? '继续结局' : '进入下一天');
    }
  });
  document.getElementById('floor-close')?.addEventListener('click', () => closeFloorBar());
  document.getElementById('floor-home')?.addEventListener('click', () => leaveVisitHome());
  ui.floorBar?.addEventListener('click', (e) => {
    if (e.target === ui.floorBar) closeFloorBar();
  });
  document.getElementById('end-stay').onclick = () => {
    ui.endCard.classList.remove('open');
    const scene = window.__hhGame?.scene.getScene('main');
    if (scene) {
      store.data.flags.doorsLocked = false;
      store.data.flags.day1_cleared = true;
      store.save();
      scene.closePanels();
      toast('可以继续在家里走动');
    }
  };
  const endSave = document.getElementById('end-save');
  if (endSave) endSave.onclick = () => openSettings({ showSave: true });
  const saveClose = document.getElementById('saveClose');
  if (saveClose) saveClose.onclick = () => ui.savePanel?.classList.remove('open');

  const openHorrorFromUi = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    openHorrorPanel();
  };
  ui.horrorMeter?.addEventListener('click', openHorrorFromUi);
  ui.hudHorror?.addEventListener('click', openHorrorFromUi);
  document.getElementById('horrorClose')?.addEventListener('click', () => closeHorrorPanel());
  ui.horrorPanel?.addEventListener('click', (e) => {
    if (e.target === ui.horrorPanel) closeHorrorPanel();
  });
  document.getElementById('death-log')?.addEventListener('click', () => openHorrorPanel());
  document.getElementById('death-restart')?.addEventListener('click', () => {
    store.reset();
    location.reload();
  });

  document.getElementById('btn-settings')?.addEventListener('click', () => toggleSettings());
  document.getElementById('settingsClose')?.addEventListener('click', () => closeSettings());
  ui.settingsPanel?.addEventListener('click', (e) => {
    if (e.target === ui.settingsPanel) closeSettings();
  });
  document.getElementById('opt-open-save')?.addEventListener('click', () => {
    const block = document.getElementById('settingsSaveBlock');
    if (!block) return;
    block.hidden = !block.hidden;
    if (!block.hidden) refreshSettingsSlots();
  });
  document.getElementById('opt-quick-save')?.addEventListener('click', () => {
    if (!window.__hhGame) {
      toast('请先进入游戏再存档');
      return;
    }
    store.data.savedAt = Date.now();
    SaveSlots.saveToSlot(1, store.data);
    toast('已快速写入槽位 1');
    refreshSettingsSlots();
  });
  document.getElementById('opt-horror-log')?.addEventListener('click', () => {
    closeSettings();
    openHorrorPanel();
  });
  document.getElementById('opt-title')?.addEventListener('click', () => {
    store.save();
    location.reload();
  });
  document.getElementById('opt-reset')?.addEventListener('click', () => {
    if (!confirm('确定清空当前进度并重新开始？')) return;
    store.reset();
    location.reload();
  });
  document.getElementById('opt-sfx-mute')?.addEventListener('click', () => {
    settings.sfxMute = !settings.sfxMute;
    localStorage.setItem('hh_sfx_mute', settings.sfxMute ? '1' : '0');
    syncSettingsForm();
  });
  document.getElementById('opt-bgm-mute')?.addEventListener('click', () => {
    const next = !window.BgmPlayer?.isMuted?.();
    window.BgmPlayer?.setMuted?.(next);
    syncSettingsForm();
  });
  document.getElementById('opt-danmaku')?.addEventListener('click', () => {
    settings.danmaku = !settings.danmaku;
    localStorage.setItem('hh_danmaku', settings.danmaku ? '1' : '0');
    syncSettingsForm();
  });
  document.getElementById('opt-pad')?.addEventListener('click', () => {
    settings.showPad = !settings.showPad;
    localStorage.setItem('hh_show_pad', settings.showPad ? '1' : '0');
    syncSettingsForm();
  });
  document.getElementById('opt-sfx-vol')?.addEventListener('input', (e) => {
    settings.sfxVol = Math.max(0, Math.min(1, Number(e.target.value) / 100));
    localStorage.setItem('hh_sfx_vol', String(settings.sfxVol));
  });
  document.getElementById('opt-bgm-vol')?.addEventListener('input', (e) => {
    window.BgmPlayer?.setVolume?.(Number(e.target.value) / 100);
  });
  document.getElementById('opt-auto-speed')?.addEventListener('change', (e) => {
    settings.autoMs = Number(e.target.value) || 2200;
    localStorage.setItem('hh_auto_ms', String(settings.autoMs));
  });

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (isCheatOpen()) {
      closeCheatPanel();
      e.preventDefault();
      return;
    }
    if (ui.floorBar?.classList.contains('open')) {
      closeFloorBar();
      e.preventDefault();
      return;
    }
    if (ui.horrorPanel && !ui.horrorPanel.hidden) {
      closeHorrorPanel();
      e.preventDefault();
      return;
    }
    if (ui.savePanel?.classList.contains('open')) {
      ui.savePanel.classList.remove('open');
      e.preventDefault();
      return;
    }
    if (ui.endCard?.classList.contains('open')) return;
    if (ui.deathCard?.classList.contains('open')) return;
    if (ui.boot && ui.boot.style.display !== 'none' && !window.__hhGame) return;
    toggleSettings();
    e.preventDefault();
  });

  document.getElementById('btn-clear').onclick = () => { store.reset(); location.reload(); };
  applyPadVisibility();
  ui.debug.querySelectorAll('[data-jump]').forEach((btn) => {
    btn.addEventListener('click', () => window.__hhCheatJump?.(btn.getAttribute('data-jump'))
      || window.__hhApplyNode?.(btn.getAttribute('data-jump')));
  });

  /** 开发开挂：预设场景（含进入前补齐的状态） */
  const CHEAT_SCENES = [
    { id: 'P04', title: '开场 · 玄关', desc: '旁白与操作说明' },
    { id: 'D1-01', title: '思思登场', desc: '客厅 · 红裙靠近', patch: { flags: { frontDoorPeeked: true } } },
    { id: 'D1-02', title: '打扫 / 红裙', desc: '线索与拖把段', patch: {
      flags: { frontDoorPeeked: true },
      familyTrust: { sisi: 1 },
    } },
    { id: 'D1-03', title: 'Boss 登场', desc: '客厅双人剧情', patch: {
      flags: { frontDoorPeeked: true, livingClean: true },
      livingVariant: 'clean',
      inventory: { mop: true },
      clues: { wetDress: true },
      familyTrust: { sisi: 2 },
    } },
    { id: 'D1-03b', title: 'Boss 后续', desc: '进入自由前', patch: {
      flags: { frontDoorPeeked: true, livingClean: true },
      livingVariant: 'clean',
      inventory: { mop: true, towel: true },
      clues: { wetDress: true },
      familyTrust: { sisi: 2, boss: 1 },
    } },
    { id: 'FREE_D1', title: '自由探索', desc: '五房互通', patch: {
      flags: { frontDoorPeeked: true, livingClean: true, freeGateToast: false },
      livingVariant: 'clean',
      inventory: { mop: true, towel: true },
      clues: { wetDress: true },
      familyTrust: { sisi: 2, boss: 1 },
      horror: 18,
    } },
    { id: 'D1-04', title: '餐桌主线', desc: '厨房续播', patch: {
      flags: { frontDoorPeeked: true, livingClean: true },
      livingVariant: 'clean',
      inventory: { mop: true, towel: true },
      clues: { wetDress: true },
      familyTrust: { sisi: 2, boss: 1 },
    } },
    { id: 'D1-04b', title: '餐桌后续', desc: '饭后过渡', patch: {
      flags: { frontDoorPeeked: true, livingClean: true },
      livingVariant: 'clean',
      inventory: { mop: true, towel: true, ateStrangeFood: true },
      clues: { wetDress: true },
      familyTrust: { sisi: 2, boss: 1 },
    } },
    { id: 'D1-05', title: '卧室夜', desc: '入睡段', patch: {
      flags: { frontDoorPeeked: true, livingClean: true, useNight: true },
      livingVariant: 'clean',
      inventory: { mop: true, towel: true, ateStrangeFood: true },
      clues: { wetDress: true },
      familyTrust: { sisi: 2, boss: 1 },
    } },
    { id: 'END_DAY1', title: '日终结算', desc: '第一天通关卡', patch: {
      flags: { frontDoorPeeked: true, livingClean: true, useNight: true },
      livingVariant: 'clean',
      inventory: { mop: true, towel: true, ateStrangeFood: true },
      clues: { wetDress: true },
      familyTrust: { sisi: 2, boss: 1 },
      horror: 22,
    } },
    { id: 'D2-00', title: '第二天晨', desc: '播报 15 人', patch: {
      day: 2, aliveCount: 15, horror: 18,
      flags: { livingClean: true, day1_cleared: true },
      livingVariant: 'clean',
      familyTrust: { sisi: 2, boss: 1 },
    } },
    { id: 'D2-04', title: '面膜冲突', desc: '祖父母', patch: {
      day: 2, aliveCount: 15, horror: 28,
      flags: { livingClean: true, bossCollapsedWarn: true },
      familyTrust: { sisi: 2, boss: 2 },
    } },
    { id: 'FREE_D2', title: 'Day2 自由', desc: '祖父母同住', patch: {
      day: 2, flags: { grandmaFaceMask: true, livingClean: true, freeGateToast: false },
      familyTrust: { sisi: 2, boss: 2, licuilan: 2 },
    } },
    { id: 'D3-03', title: '授刀', desc: '爱的屠刀', patch: {
      day: 3, aliveCount: 12, flags: { grandmaFaceMask: true, grandpaCookOk: true },
      familyTrust: { sisi: 3, boss: 2 },
    } },
    { id: 'D4-00', title: '拜访出门', desc: '第四天', patch: {
      day: 4, aliveCount: 10, inventory: { cleaver: true },
      flags: { gotCleaver: true, sisiRedSkirtBoost: true, day3_cleared: true },
    } },
    { id: 'FREE_VISIT_D4', title: '可走楼道', desc: '电梯/门牌拜访', patch: {
      day: 4, aliveCount: 10, inventory: { cleaver: true },
      flags: { gotCleaver: true, sisiRedSkirtBoost: true },
      visitReturnNode: 'FREE_VISIT_D4',
    } },
    { id: 'FREE_VISIT_D5', title: 'Day5 楼道', desc: '含 8 层高危', patch: {
      day: 5, aliveCount: 8, visitCards: 12, inventory: { cleaver: true },
      flags: { gotCleaver: true, visitedFriendly: true, metSuxiaomo: true },
      visitReturnNode: 'FREE_VISIT_D5',
    } },
    { id: 'D6-00', title: '红姐对峙前', desc: '第六天', patch: {
      day: 6, aliveCount: 5, visitCards: 18, inventory: { cleaver: true },
      flags: { gotCleaver: true, visitWithFriends: true, metSuxiaomo: true, metFangyuan: true },
    } },
    { id: 'D7-AMBUSH', title: '门前伏击 E9', desc: '放走红姐', patch: {
      day: 7, visitCards: 20, inventory: { cleaver: true },
      flags: { hongjieSpared: true, gotCleaver: true, day6_cleared: true },
    } },
    { id: 'D7-00', title: '第七天拼门', desc: '结局前', patch: {
      day: 7, aliveCount: 3, visitCards: 22, horror: 16,
      flags: { gotCleaver: true, day6_cleared: true, refuseMother: false },
      familyTrust: { sisi: 4, boss: 3, liuaiguo: 2, licuilan: 2 },
    } },
    { id: 'END_STAY', title: 'E5 想留不成', desc: '结局卡', patch: {
      day: 7, visitCards: 22, horror: 12,
      flags: { stayedBehindAttempt: true, acceptedHeartKey: true },
    } },
    { id: 'END_HUNTER', title: 'E8 猎手', desc: '结局卡', patch: {
      day: 7, visitCards: 28, horror: 40,
      flags: { hunterTrack: true, acceptedHeartKey: true, blackHearts: false },
    } },
  ];

  function isTypingTarget(el) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
  }

  function isCheatOpen() {
    return !!ui.cheatPanel?.classList.contains('open');
  }

  function closeCheatPanel() {
    if (!ui.cheatPanel) return;
    ui.cheatPanel.classList.remove('open');
    ui.cheatPanel.setAttribute('aria-hidden', 'true');
    setMoveHud(window.__hhGame?.scene.getScene('main'));
  }

  function openCheatPanel() {
    if (!CFG.devCheat || !ui.cheatPanel) return;
    closeSettings();
    ui.debug?.classList.remove('open');
    ui.cheatPanel.classList.add('open');
    ui.cheatPanel.setAttribute('aria-hidden', 'false');
    setMoveHud(window.__hhGame?.scene.getScene('main'));
  }

  function toggleCheatPanel() {
    if (!CFG.devCheat) return;
    if (isCheatOpen()) closeCheatPanel();
    else openCheatPanel();
  }

  function applyCheatPatch(patch) {
    if (!patch) return;
    const d = store.data;
    Object.entries(patch).forEach(([key, val]) => {
      if (val && typeof val === 'object' && !Array.isArray(val) && d[key] && typeof d[key] === 'object') {
        Object.assign(d[key], val);
      } else {
        d[key] = val;
      }
    });
  }

  function cheatJump(nodeId) {
    const preset = CHEAT_SCENES.find((s) => s.id === nodeId) || { id: nodeId, title: nodeId };
    closeCheatPanel();
    ui.endCard?.classList.remove('open');
    ui.deathCard?.classList.remove('open');
    ui.savePanel?.classList.remove('open');
    closeHorrorPanel();

    const runJump = () => {
      const scene = window.__hhGame?.scene.getScene('main');
      if (!scene) {
        toast('场景未就绪，稍后再试');
        return;
      }
      if (Object.keys(nodes).length && !nodes[preset.id]) {
        toast(`未知节点 ${preset.id}`);
        return;
      }
      scene.closePanels?.();
      activeChoiceHandler = null;
      if (scene.briefingDone) delete scene.briefingDone[preset.id];
      applyCheatPatch(preset.patch);
      store.data.flags.horrorDead = false;
      store.save();
      scene.applyNode(preset.id);
      refreshHud();
      toast(`开挂 → ${preset.title || preset.id}`);
    };

    if (!window.__hhGame) {
      if (window.__hhCheatBooting) {
        window.__hhPendingCheat = preset.id;
        return;
      }
      window.__hhPendingCheat = preset.id;
      window.__hhCheatBooting = true;
      window.BgmPlayer?.unlock?.();
      Promise.resolve(bootGame(false)).finally(() => {
        window.__hhCheatBooting = false;
      }).then(() => {
        const id = window.__hhPendingCheat;
        window.__hhPendingCheat = null;
        if (!id) return;
        setTimeout(() => cheatJump(id), 480);
      });
      return;
    }
    runJump();
  }

  function buildCheatList() {
    if (!ui.cheatList) return;
    ui.cheatList.innerHTML = '';
    CHEAT_SCENES.forEach((s) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = `${s.title}<small>${s.id}${s.desc ? ' · ' + s.desc : ''}</small>`;
      btn.addEventListener('click', () => cheatJump(s.id));
      ui.cheatList.appendChild(btn);
    });
  }

  if (CFG.devCheat) {
    buildCheatList();
    document.getElementById('cheatClose')?.addEventListener('click', closeCheatPanel);
    ui.cheatPanel?.addEventListener('click', (e) => {
      if (e.target === ui.cheatPanel) closeCheatPanel();
    });
    window.__hhCheatJump = cheatJump;
  }

  window.addEventListener('keydown', (e) => {
    if (!CFG.devCheat) return;
    if (e.key !== 'p' && e.key !== 'P') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTypingTarget(e.target)) return;
    e.preventDefault();
    toggleCheatPanel();
  });

  document.getElementById('dlg-tools-toggle')?.addEventListener('click', () => {
    const bar = document.getElementById('dlg-toolbar');
    const btn = document.getElementById('dlg-tools-toggle');
    if (!bar || !btn) return;
    bar.classList.toggle('collapsed');
    const expanded = !bar.classList.contains('collapsed');
    btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    btn.textContent = expanded ? '收起' : '⋯';
  });

  window.DialogueShell?.bind?.(() => {
    const scene = window.__hhGame?.scene.getScene('main');
    if (scene?.dialogueOpen && !scene.aiOpen) scene.advanceDialogue();
  });
})();
