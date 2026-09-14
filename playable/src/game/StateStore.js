class StateStore {
  constructor(saveKey) {
    this.saveKey = saveKey;
    this.data = StateStore.defaultState();
  }

  static defaultState() {
    return {
      day: 1,
      aliveCount: 30,
      floor: 30,
      roomId: 'room_xuanguan',
      familyTrust: { sisi: 0, boss: 0, liuaiguo: 0, licuilan: 0 },
      clues: { wetDress: false, redSisterClue: false },
      inventory: { mop: false, towel: false, ateStrangeFood: false, cleaver: false },
      visitCards: 0,
      npcChatState: {
        sisi: { met: false, lastTopic: null },
        boss: { met: false, lastTopic: null },
        liuaiguo: { met: false, lastTopic: null },
        licuilan: { met: false, lastTopic: null },
      },
      flags: { doorsLocked: false, day1_cleared: false, useNight: false, lightsDim: false },
      nodeId: 'P04',
      playerX: 420,
    };
  }

  load() {
    try {
      const raw = localStorage.getItem(this.saveKey);
      if (!raw) return false;
      this.data = { ...StateStore.defaultState(), ...JSON.parse(raw) };
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

  applyEffects(effects = {}) {
    Object.entries(effects).forEach(([path, value]) => {
      if (path === 'reset' && value) {
        this.reset();
        return;
      }
      const parts = path.split('.');
      if (parts.length === 2) {
        const [a, b] = parts;
        if (typeof this.data[a]?.[b] === 'number' && typeof value === 'number') {
          this.data[a][b] += value;
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
