/**
 * 多槽本地存档（基于 StateStore.saveKey）
 */
(() => {
  const SLOT_COUNT = 3;

  function baseKey() {
    return window.HH_CONFIG?.saveKey || 'hh_movable_day1_v3';
  }

  function slotKey(n) {
    return `${baseKey()}_slot${n}`;
  }

  function list() {
    const out = [];
    for (let i = 1; i <= SLOT_COUNT; i += 1) {
      try {
        const raw = localStorage.getItem(slotKey(i));
        if (!raw) {
          out.push({ slot: i, empty: true });
          continue;
        }
        const data = JSON.parse(raw);
        out.push({
          slot: i,
          empty: false,
          nodeId: data.nodeId,
          roomId: data.roomId,
          day: data.day,
          horror: data.horror ?? 0,
          savedAt: data.savedAt || null,
        });
      } catch {
        out.push({ slot: i, empty: true });
      }
    }
    return out;
  }

  function saveToSlot(slot, data) {
    const payload = { ...data, savedAt: Date.now() };
    localStorage.setItem(slotKey(slot), JSON.stringify(payload));
    // 同步默认「继续」槽
    localStorage.setItem(baseKey(), JSON.stringify(payload));
    return true;
  }

  function loadFromSlot(slot) {
    const raw = localStorage.getItem(slotKey(slot));
    if (!raw) return null;
    const data = JSON.parse(raw);
    localStorage.setItem(baseKey(), raw);
    return data;
  }

  function clearSlot(slot) {
    localStorage.removeItem(slotKey(slot));
  }

  function formatMeta(entry) {
    if (entry.empty) return `槽位 ${entry.slot} · 空`;
    const t = entry.savedAt ? new Date(entry.savedAt).toLocaleString() : '';
    return `槽位 ${entry.slot} · Day${entry.day} · ${entry.nodeId} · 惊悚${entry.horror}${t ? ` · ${t}` : ''}`;
  }

  window.SaveSlots = {
    SLOT_COUNT,
    list,
    saveToSlot,
    loadFromSlot,
    clearSlot,
    formatMeta,
  };
})();
