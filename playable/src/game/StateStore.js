class StateStore {
  constructor(saveKey) {
    this.saveKey = saveKey;
    this.data = StateStore.defaultState();
    /** @type {null | ((info: object) => void)} */
    this.onHorrorChange = null;
  }

  static defaultState() {
    return {
      day: 1,
      aliveCount: 30,
      floor: 30,
      roomId: 'room_xuanguan',
      familyTrust: { sisi: 0, boss: 0, liuaiguo: 0, licuilan: 0 },
      clues: { wetDress: false, redSisterClue: false, killSteal: false },
      inventory: { mop: false, towel: false, ateStrangeFood: false, cleaver: false, faceMask: false },
      visitCards: 0,
      visitReturnNode: '',
      horror: 0,
      horrorLog: [],
      livingVariant: 'default',
      npcChatState: {
        sisi: { met: false, lastTopic: null },
        boss: { met: false, lastTopic: null },
        liuaiguo: { met: false, lastTopic: null },
        licuilan: { met: false, lastTopic: null },
      },
      flags: {
        doorsLocked: false,
        day1_cleared: false,
        useNight: false,
        lightsDim: false,
        livingClean: false,
        freeGateToast: false,
        horrorDead: false,
        frontDoorPeeked: false,
        refuseMother: false,
        pushAway: false,
        fearBoss: false,
        coldDinner: false,
        trustHongjie: false,
        suspectHongjie: false,
        bossCollapsedWarn: false,
        grandmaFaceMask: false,
        grandpaCookOk: false,
        familyWarMediated: false,
        gotCleaver: false,
        sisiRedSkirtBoost: false,
        visitWithFriends: false,
        sharedCards: false,
        refusedHeartKey: false,
        acceptedHeartKey: false,
        stayedBehindAttempt: false,
        blackFogRisk: false,
        hunterTrack: false,
        hongjieSpared: false,
        knowKillSteal: false,
        blackHearts: false,
        day2_cleared: false,
        day3_cleared: false,
        day4_cleared: false,
        day5_cleared: false,
        day6_cleared: false,
        visitedHostile: false,
        visitedFriendly: false,
        visitedPuzzle: false,
        visitedEmpty: false,
        visitedBossNear: false,
        metSuxiaomo: false,
        metFangyuan: false,
        hunterRedeemed: false,
        friendsBlackHeart: false,
        ambushSurvived: false,
      },
      nodeId: 'P04',
      playerX: 420,
    };
  }

  /** 原书：通关积分 ≈ 100 − 惊悚；100 即死。 */
  static clearPoints(horror) {
    const h = Math.max(0, Math.min(100, Number(horror) || 0));
    if (h >= 100) return 0;
    return Math.max(0, 100 - Math.floor(h));
  }

  static horrorBand(horror) {
    const h = Number(horror) || 0;
    if (h >= 100) return { key: 'dead', label: '致死', tip: '惊悚值 100：死亡' };
    if (h >= 60) return { key: 'danger', label: '危险', tip: '已超过老手常见上限（60）' };
    if (h >= 30) return { key: 'tense', label: '紧绷', tip: '尚可；认家人照顾可压回去' };
    return { key: 'calm', label: '平稳', tip: '偏低：更接近宁念「看不清所以不怕」' };
  }

  load() {
    try {
      const raw = localStorage.getItem(this.saveKey);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      const base = StateStore.defaultState();
      this.data = {
        ...base,
        ...parsed,
        familyTrust: { ...base.familyTrust, ...(parsed.familyTrust || {}) },
        clues: { ...base.clues, ...(parsed.clues || {}) },
        inventory: { ...base.inventory, ...(parsed.inventory || {}) },
        npcChatState: { ...base.npcChatState, ...(parsed.npcChatState || {}) },
        flags: { ...base.flags, ...(parsed.flags || {}) },
        horrorLog: Array.isArray(parsed.horrorLog) ? parsed.horrorLog.slice(-50) : [],
      };
      return true;
    } catch {
      return false;
    }
  }

  save() {
    localStorage.setItem(this.saveKey, JSON.stringify(this.data));
  }

  reset() {
    this.data = StateStore.defaultState();
    this.save();
  }

  /**
   * @param {number} value
   * @param {{ relative?: boolean, reason?: string, source?: string }} [opts]
   */
  setHorror(value, { relative = false, reason = '', source = 'system' } = {}) {
    if (this.data.flags.horrorDead) return this.data.horror;

    const prev = Number(this.data.horror) || 0;
    let next = relative ? prev + (Number(value) || 0) : Number(value) || 0;
    next = Math.max(0, Math.min(100, next));
    const delta = next - prev;

    this.data.horror = next;

    if (delta !== 0) {
      if (!Array.isArray(this.data.horrorLog)) this.data.horrorLog = [];
      const entry = {
        t: Date.now(),
        from: prev,
        to: next,
        delta,
        reason: reason || (relative ? (delta > 0 ? '惊悚上升' : '惊悚下降') : '惊悚值被设定'),
        source: source || 'system',
        nodeId: this.data.nodeId,
      };
      this.data.horrorLog.push(entry);
      if (this.data.horrorLog.length > 50) {
        this.data.horrorLog.splice(0, this.data.horrorLog.length - 50);
      }

      if (next >= 100) {
        this.data.flags.horrorDead = true;
        this.data.horrorLog.push({
          t: Date.now(),
          from: next,
          to: 100,
          delta: 0,
          reason: '惊悚值达到 100：按副本规则死亡（原书）',
          source: 'rule',
          nodeId: this.data.nodeId,
        });
      }

      this.save();
      if (typeof this.onHorrorChange === 'function') {
        this.onHorrorChange({ ...entry, dead: next >= 100 });
      }
    } else {
      this.save();
    }

    return this.data.horror;
  }

  applyEffects(effects = {}) {
    const reason = effects.horrorReason || '';
    Object.entries(effects).forEach(([path, value]) => {
      if (path === 'horrorReason') return;
      if (path === 'reset' && value) {
        this.reset();
        return;
      }
      if (path === 'horror') {
        this.setHorror(value, {
          relative: true,
          reason: reason || '选项影响',
          source: 'choice',
        });
        return;
      }
      if (path === 'horrorSet') {
        this.setHorror(value, {
          relative: false,
          reason: reason || '选项将惊悚值设定',
          source: 'choice',
        });
        return;
      }
      if (path === 'visitCards') {
        this.data.visitCards = Math.max(0, (Number(this.data.visitCards) || 0) + (Number(value) || 0));
        return;
      }
      if (path === 'livingVariant') {
        this.data.livingVariant = value;
        if (value === 'clean') this.data.flags.livingClean = true;
        return;
      }
      const parts = path.split('.');
      if (parts.length === 2) {
        const [a, b] = parts;
        if (typeof this.data[a]?.[b] === 'number' && typeof value === 'number') {
          this.data[a][b] = Math.max(0, this.data[a][b] + value);
        } else if (this.data[a]) {
          this.data[a][b] = value;
        }
      } else if (parts.length === 1) {
        this.data[parts[0]] = value;
      }
    });
    this.save();
  }
}

window.StateStore = StateStore;
