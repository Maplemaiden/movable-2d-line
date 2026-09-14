(() => {
  const CFG = window.HH_CONFIG;
  const store = new StateStore(CFG.saveKey);

  let rooms = {};
  let nodes = {};
  let npcsData = {};
  let hotspots = [];
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
    hudNode: document.getElementById('hud-node'),
    hudRoom: document.getElementById('hud-room'),
    hudDay: document.getElementById('hud-day'),
    hudAlive: document.getElementById('hud-alive'),
    hudTs: document.getElementById('hud-ts'),
    hudTb: document.getElementById('hud-tb'),
    hudInv: document.getElementById('hud-inv'),
    hint: document.getElementById('hint'),
    muteBtn: document.getElementById('btn-mute'),
    btnLeft: document.getElementById('btn-left'),
    btnRight: document.getElementById('btn-right'),
    btnAct: document.getElementById('btn-act'),
  };

  const hold = { left: false, right: false };
  const keyDown = Object.create(null);

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    keyDown[k] = true;
    if (['arrowleft', 'arrowright', ' ', 'a', 'd'].includes(k)) e.preventDefault();
  }, { passive: false });
  window.addEventListener('keyup', (e) => {
    keyDown[e.key.toLowerCase()] = false;
  });
  window.addEventListener('blur', () => {
    Object.keys(keyDown).forEach((k) => { keyDown[k] = false; });
    hold.left = hold.right = false;
  });

  function bindHold(btn, side) {
    if (!btn) return;
    const on = (v) => (e) => {
      e.preventDefault();
      hold[side] = v;
      btn.classList.toggle('held', v);
    };
    btn.addEventListener('mousedown', on(true));
    btn.addEventListener('mouseup', on(false));
    btn.addEventListener('mouseleave', on(false));
    btn.addEventListener('touchstart', on(true), { passive: false });
    btn.addEventListener('touchend', on(false));
    btn.addEventListener('touchcancel', on(false));
  }
  bindHold(ui.btnLeft, 'left');
  bindHold(ui.btnRight, 'right');
  if (ui.btnAct) ui.btnAct.addEventListener('click', () => {
    window.__hhGame?.scene.getScene('main')?.tryInteract();
  });

  const SFX = {};
  let muted = localStorage.getItem('hh_mute') === '1';

  function toast(msg) {
    ui.toast.textContent = msg;
    ui.toast.style.display = 'block';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (ui.toast.style.display = 'none'), 2600);
  }

  function playSfx(key, vol = 0.45) {
    if (muted || !SFX[key]) return;
    try {
      const a = SFX[key].cloneNode();
      a.volume = vol;
      a.play().catch(() => {});
    } catch (_) {}
  }

  function refreshHud() {
    const s = store.data;
    const room = rooms[s.roomId];
    ui.hudNode.textContent = s.nodeId;
    ui.hudRoom.textContent = room?.name || s.roomId;
    ui.hudDay.textContent = s.day;
    ui.hudAlive.textContent = s.aliveCount;
    ui.hudTs.textContent = s.familyTrust.sisi;
    ui.hudTb.textContent = s.familyTrust.boss;
    const inv = Object.entries(s.inventory).filter(([, v]) => v).map(([k]) => k);
    ui.hudInv.textContent = inv.length ? inv.join(' · ') : '空';
    const node = nodes[s.nodeId];
    if (node?.advanceHint && ui.hint) ui.hint.textContent = node.advanceHint;
    ui.debugPre.textContent = JSON.stringify(s, null, 2);
    if (ui.muteBtn) ui.muteBtn.textContent = muted ? '音效:关' : '音效:开';
  }

  async function loadJson(path) {
    const res = await fetch(path + '?t=' + Date.now());
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
      const bgs = [
        'bg_xuanguan_day', 'bg_living_day', 'bg_living_night', 'bg_kitchen_day',
        'bg_bedroom_day', 'bg_bedroom_night', 'bg_bathroom',
        'bg_corridor_visit', 'bg_otherworld_gates', 'bg_room_twins',
        'bg_room_cosplay', 'bg_floor10_bones', 'bg_room_mother_boy',
      ];
      bgs.forEach((k) => this.load.image(k, `./assets/bg/${k}.png?v=side3`));

      const chars = [
        'ningnian_idle', 'ningnian_walk1', 'ningnian_walk2',
        'sisi_idle', 'sisi_walk1', 'sisi_walk2', 'sisi_red_idle', 'sisi_hug',
        'boss_idle', 'boss_walk1', 'boss_walk2',
        'liuaiguo_idle', 'licuilan_idle',
      ];
      chars.forEach((k) => this.load.image(k, `./assets/char/${k}.png?v=side3`));

      ['mop', 'towel', 'red_dress', 'meat_dish'].forEach((k) => {
        this.load.image(k, `./assets/prop/${k}.png?v=side3`);
      });

      this.load.audio('door', './assets/audio/door.wav');
      this.load.audio('ui_click', './assets/audio/ui_click.wav');
      this.load.audio('sting_low', './assets/audio/sting_low.wav');
      this.load.audio('pickup', './assets/audio/pickup.wav');
      this.load.audio('step', './assets/audio/step.wav');
    }

    create() {
      // also bind HTML Audio for UI outside phaser
      ['door', 'ui_click', 'sting_low', 'pickup', 'step'].forEach((k) => {
        SFX[k] = new Audio(`./assets/audio/${k}.wav`);
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
      this.walkFrame = 0;
      this.walkAcc = 0;
      this.stepAcc = 0;
      this.dimOverlay = null;
      this.chatHistory = { sisi: [], boss: [], liuaiguo: [], licuilan: [] };

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

      this.input.keyboard.on('keydown-E', () => this.tryInteract());
      this.input.keyboard.on('keydown-SPACE', () => {
        if (this.dialogueOpen && !this.aiOpen) this.advanceDialogue();
      });
      this.input.keyboard.on('keydown-C', () => this.openAiWithNearest());
      this.input.keyboard.on('keydown-ESC', () => this.closePanels());
      this.input.keyboard.on('keydown-BACKTICK', () => ui.debug.classList.toggle('open'));

      this.input.once('pointerdown', () => { audioUnlocked = true; });
    }

    update(_, dt) {
      if (!this.playerCanMove || this.dialogueOpen || this.aiOpen) {
        this.setPlayerIdle();
        this.syncPrompt();
        this.syncGuide();
        return;
      }

      const speed = CFG.playerSpeed * (dt / 1000);
      let vx = 0;
      const left = hold.left || keyDown.a || keyDown.arrowleft || this.keys.left.isDown || this.keys.left2.isDown;
      const right = hold.right || keyDown.d || keyDown.arrowright || this.keys.right.isDown || this.keys.right2.isDown;
      if (left) vx -= 1;
      if (right) vx += 1;

      if (vx !== 0) {
        this.player.x = Phaser.Math.Clamp(this.player.x + vx * speed, 120, this.worldWidth - 120);
        this.player.setFlipX(vx < 0);
        store.data.playerX = this.player.x;
        this.walkAcc += dt;
        this.stepAcc += dt;
        if (this.walkAcc > 140) {
          this.walkAcc = 0;
          this.walkFrame = 1 - this.walkFrame;
          this.player.setTexture(this.walkFrame ? 'ningnian_walk1' : 'ningnian_walk2');
          setCharDisplay(this.player, 360);
        }
        if (this.stepAcc > 280) {
          this.stepAcc = 0;
          playSfx('step', 0.15);
        }
      } else {
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
      }
      if (tx == null) {
        ui.guide.classList.remove('open');
        return;
      }
      const host = ui.guide.parentElement;
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
        ui.prompt.style.display = 'none';
        return;
      }
      const host = ui.prompt.parentElement;
      const cam = this.cameras.main;
      const x = (target.x - cam.scrollX) * (host.clientWidth / CFG.designWidth);
      const y = (CFG.groundY - 400 - cam.scrollY) * (host.clientHeight / CFG.designHeight);
      ui.prompt.style.display = 'block';
      ui.prompt.style.left = `${x}px`;
      ui.prompt.style.top = `${y}px`;
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
          best = { type: 'hotspot', id: h.hotId, x: h.x, label: `E ${h.label}`, data: h.data };
        }
      });

      const node = nodes[store.data.nodeId];
      if (!store.data.flags.doorsLocked) {
        this.doorZones.forEach((d) => {
          if (node?.allowRooms) {
            const dest = d.target;
            if (dest && dest !== store.data.roomId && !node.allowRooms.includes(dest)) return;
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

    tryInteract() {
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
      ui.dialogue.classList.add('open');
      ui.aiRow.classList.add('open');
      ui.dlgChoices.innerHTML = '';
      ui.dlgName.textContent = meta.displayName;
      ui.dlgText.textContent = ai.hasKey()
        ? '你可以直接说话。回车发送。'
        : '未检测到 API 密钥，将使用角色兜底短句。仍可输入试玩。';
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

    closePanels() {
      this.dialogueOpen = false;
      this.aiOpen = false;
      this.playerCanMove = true;
      ui.dialogue.classList.remove('open');
      ui.aiRow.classList.remove('open');
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      // ensure game can receive keys again
      try { this.game.canvas.focus(); } catch (_) {}
      this.syncGuide();
    }

    loadRoom(roomId, x, fade = true) {
      const room = rooms[roomId];
      if (!room) return;
      const node = nodes[store.data.nodeId] || {};
      const night = !!node.night || !!store.data.flags.useNight;
      const bgKey = night && room.bgNight ? room.bgNight : room.bg;

      const apply = () => {
        store.data.roomId = roomId;
        this.worldWidth = room.width || 2560;
        this.cameras.main.setBounds(0, 0, this.worldWidth, CFG.designHeight);
        if (this.textures.exists(bgKey)) this.bg.setTexture(bgKey);
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
      };

      if (fade) {
        playSfx('door', 0.35);
        this.cameras.main.fadeOut(160, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          apply();
          this.cameras.main.fadeIn(160, 0, 0, 0);
        });
      } else apply();
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
      this.hotspotSprites.forEach((s) => s.destroy());
      this.hotspotSprites = [];
      hotspots.filter((h) => h.room === roomId && this.hotspotAllowed(h)).forEach((h) => {
        let sprite;
        if (h.prop && this.textures.exists(h.prop)) {
          sprite = this.add.image(h.x, CFG.groundY - 10, h.prop).setOrigin(0.5, 1);
          sprite.setDisplaySize(100, 100);
        } else {
          sprite = this.add.circle(h.x, CFG.groundY - 36, 16, 0x8eb6d8, 0.4);
        }
        sprite.hotId = h.id;
        sprite.label = h.label;
        sprite.data = h;
        sprite.setDepth(5);
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
      if (store.data.flags.doorsLocked) {
        toast('现在走不开……');
        return;
      }
      const node = nodes[store.data.nodeId];
      if (node?.allowRooms) {
        const dest = door.target;
        if (dest !== node.room && !node.allowRooms.includes(dest)) {
          toast('现在先别乱跑……');
          return;
        }
      }
      if (node?.nextOnDoor?.[door.id]) {
        this.applyNode(node.nextOnDoor[door.id]);
        return;
      }
      this.loadRoom(door.target, door.targetX, true);
    }

    useHotspot(h) {
      if (!h) return;
      if (h.type === 'pickup') {
        if (h.inventory) store.data.inventory[h.inventory] = true;
        if (h.trust) {
          Object.entries(h.trust).forEach(([k, v]) => {
            store.data.familyTrust[k] = (store.data.familyTrust[k] || 0) + v;
          });
        }
        store.save();
        playSfx('pickup');
        this.showSimple(h.label, h.text, () => this.rebuildHotspots(store.data.roomId));
        refreshHud();
        return;
      }
      if (h.type === 'observe') {
        if (h.clue) store.data.clues[h.clue] = true;
        store.save();
        playSfx('ui_click', 0.2);
        this.showSimple(h.label, h.text);
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
          this.applyNode(node.storyNext);
          return;
        }
        this.showSimple(h.label, h.text);
      }
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
          x: this.player.x + (this.player.flipX ? -40 : 40),
          duration: 450,
          ease: 'Quad.easeOut',
        });
      }
      this.playerCanMove = false;
      this.lineQueue = (pack.dialogue || []).map((l) => ({ ...l }));
      this.pendingChoices = pack.choices || null;
      this.dialogueOpen = true;
      ui.dialogue.classList.add('open');
      ui.aiRow.classList.remove('open');
      ui.dlgChoices.innerHTML = '';
      this.advanceDialogue();
    }

    checkAutoStoryHotspot() {
      const node = nodes[store.data.nodeId];
      if (!node?.storyHotspot || node.autoDialogue || this.storyTriggerLock) return;
      if (this.dialogueOpen || this.aiOpen) return;
      const h = hotspots.find((x) => x.id === node.storyHotspot);
      if (!h || h.room !== store.data.roomId) return;
      if (Math.abs(this.player.x - h.x) < 100) {
        this.storyTriggerLock = true;
        this.applyNode(node.storyNext);
        this.time.delayedCall(600, () => { this.storyTriggerLock = false; });
      }
    }

    showSimple(name, text, onClose) {
      this.dialogueOpen = true;
      this.playerCanMove = false;
      ui.dialogue.classList.add('open');
      ui.aiRow.classList.remove('open');
      ui.dlgName.textContent = name;
      ui.dlgText.textContent = text;
      ui.dlgChoices.innerHTML = '';
      const btn = document.createElement('button');
      btn.textContent = '继续';
      btn.onclick = () => {
        playSfx('ui_click', 0.2);
        this.closePanels();
        if (onClose) onClose();
      };
      ui.dlgChoices.appendChild(btn);
    }

    applyNode(nodeId, fromBoot = false) {
      const node = nodes[nodeId];
      if (!node) return;
      store.data.nodeId = nodeId;
      if (node.onEnter) Object.assign(store.data, node.onEnter);
      store.data.flags.doorsLocked = !!node.lockDoors;
      if (node.night) store.data.flags.useNight = true;
      if (node.aiStage) ai.setStage(node.aiStage);
      store.save();

      if (node.sound) playSfx(node.sound, 0.5);
      if (nodeId === 'D1-03') {
        this.cameras.main.shake(420, 0.004);
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

        if (node.autoDialogue) {
          this.startNodeDialogue(node);
        } else if (node.intro && (fromBoot || nodeId === 'P04' || node.choices)) {
          this.lineQueue = node.intro.map((l) => ({ ...l }));
          this.pendingChoices = node.choices || [{ text: '开始走动', unlockMove: true, next: null }];
          this.dialogueOpen = true;
          this.playerCanMove = false;
          ui.dialogue.classList.add('open');
          ui.aiRow.classList.remove('open');
          this.advanceDialogue();
        } else if (node.approachTrigger) {
          toast(node.advanceHint || '靠近目标…');
          this.playerCanMove = true;
        }

        if (node.ending) {
          store.data.flags.day1_cleared = true;
          store.data.day = 2;
          store.save();
        }
        this.syncGuide();
      };

      const needRoom = node.room && node.room !== store.data.roomId;
      if (needRoom) {
        this.loadRoom(node.room, node.spawnPlayerX ?? rooms[node.room].spawnX, !fromBoot);
        this.time.delayedCall(fromBoot ? 50 : 420, after);
      } else {
        const room = rooms[store.data.roomId];
        if (room) {
          const night = !!node.night || !!store.data.flags.useNight;
          const bgKey = night && room.bgNight ? room.bgNight : room.bg;
          if (this.textures.exists(bgKey) && this.bg.texture.key !== bgKey) this.bg.setTexture(bgKey);
          this.bg.setDisplaySize(this.worldWidth, CFG.designHeight);
        }
        after();
      }
    }

    startNodeDialogue(node) {
      this.lineQueue = (node.dialogue || []).map((l) => ({ ...l }));
      this.pendingChoices = node.choices || null;
      this.dialogueOpen = true;
      this.playerCanMove = false;
      ui.dialogue.classList.add('open');
      ui.aiRow.classList.remove('open');
      ui.dlgChoices.innerHTML = '';
      if (!this.lineQueue.length) this.showChoices(this.pendingChoices);
      else this.advanceDialogue();
    }

    advanceDialogue() {
      if (!this.dialogueOpen || this.aiOpen) return;
      if (!this.lineQueue.length) {
        if (this.pendingChoices) this.showChoices(this.pendingChoices);
        else this.closePanels();
        return;
      }
      const line = this.lineQueue.shift();
      const nameMap = {
        system: '系统', sisi: '秦思思', boss: '？？？',
        liuaiguo: '刘爱国', licuilan: '李翠兰',
      };
      ui.dlgName.textContent = nameMap[line.speaker] || line.speaker;
      ui.dlgText.textContent = line.text;
      ui.dlgChoices.innerHTML = '';
      playSfx('ui_click', 0.12);

      if (!this.lineQueue.length && this.pendingChoices) {
        this.showChoices(this.pendingChoices);
      } else {
        const btn = document.createElement('button');
        btn.textContent = this.lineQueue.length ? '继续' : '…';
        btn.onclick = () => this.advanceDialogue();
        ui.dlgChoices.appendChild(btn);
      }
    }

    showChoices(choices) {
      ui.dlgChoices.innerHTML = '';
      if (!choices || !choices.length) {
        this.closePanels();
        return;
      }
      choices.forEach((c) => {
        const btn = document.createElement('button');
        btn.textContent = c.text;
        btn.onclick = () => {
          playSfx('ui_click', 0.25);
          store.applyEffects(c.effects || {});
          // towel bonus
          if (c.text.includes('毛巾') && store.data.inventory.towel) {
            store.data.familyTrust.sisi += 1;
            store.save();
          }
          refreshHud();
          this.closePanels();
          if (c.effects?.reset) {
            location.reload();
            return;
          }
          if (c.unlockMove) {
            this.playerCanMove = true;
            toast('用 A/D 或左下角 ◀ ▶ 移动，走到门按 E');
            this.syncGuide();
            return;
          }
          if (c.showEnd || c.effects?.['flags.day1_cleared']) {
            store.data.flags.doorsLocked = false;
            store.data.flags.day1_cleared = true;
            store.data.day = 2;
            store.save();
            refreshHud();
            const stats = document.getElementById('end-stats');
            if (stats) {
              stats.textContent = `信任 思思 ${store.data.familyTrust.sisi} / Boss ${store.data.familyTrust.boss} · 线索湿裙 ${store.data.clues.wetDress ? '是' : '否'} · 背包 ${Object.entries(store.data.inventory).filter(([,v])=>v).map(([k])=>k).join(',') || '空'}`;
            }
            ui.endCard.classList.add('open');
            return;
          }
          if (c.next) this.applyNode(c.next);
        };
        ui.dlgChoices.appendChild(btn);
      });
    }
  }

  async function bootGame(continueSave) {
    if (window.__hhGame) {
      window.__hhGame.destroy(true);
      window.__hhGame = null;
    }
    rooms = await loadJson('./data/rooms.json');
    nodes = await loadJson('./data/day1.nodes.json');
    npcsData = await loadJson('./data/npcs.json');
    hotspots = await loadJson('./data/hotspots.json');
    prompts = await loadJson('./prompts/npc_stages.json');
    ai = new AiNpcClient(CFG, prompts);

    if (continueSave) {
      if (!store.load()) toast('没有存档，开始新游戏');
    } else store.reset();

    ui.boot.style.display = 'none';
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game-host',
      width: CFG.designWidth,
      height: CFG.designHeight,
      backgroundColor: '#000000',
      audio: { disableWebAudio: false },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [MainScene],
    });
    window.__hhGame = game;
    window.__hhStore = store;
    window.__hhApplyNode = (id) => game.scene.getScene('main')?.applyNode(id);
    if (!ai.hasKey()) toast('API 密钥未灌入：AI 走兜底短句');
  }

  document.getElementById('btn-new').onclick = () => bootGame(false);
  document.getElementById('btn-continue').onclick = () => bootGame(true);
  document.getElementById('ai-send').onclick = () => window.__hhGame?.scene.getScene('main')?.sendAi();
  document.getElementById('ai-close').onclick = () => window.__hhGame?.scene.getScene('main')?.closePanels();
  document.getElementById('ai-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('ai-send').click();
    }
  });
  document.getElementById('end-restart').onclick = () => { store.reset(); location.reload(); };
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
  document.getElementById('btn-clear').onclick = () => { store.reset(); location.reload(); };
  if (ui.muteBtn) {
    ui.muteBtn.onclick = () => {
      muted = !muted;
      localStorage.setItem('hh_mute', muted ? '1' : '0');
      refreshHud();
    };
  }
  ui.debug.querySelectorAll('[data-jump]').forEach((btn) => {
    btn.addEventListener('click', () => window.__hhApplyNode?.(btn.getAttribute('data-jump')));
  });
})();
