/**
 * 对话壳：历史 / 回退 / 自动 / 跳过（不回滚房间坐标）
 */
(() => {
  const state = {
    log: [],
    stack: [],
    auto: false,
    skip: false,
    autoTimer: null,
    onAdvance: null,
  };

  function els() {
    return {
      panel: document.getElementById('historyPanel'),
      list: document.getElementById('historyList'),
      btnAuto: document.getElementById('dlg-auto'),
      btnSkip: document.getElementById('dlg-skip'),
      btnBack: document.getElementById('dlg-back'),
      btnHist: document.getElementById('dlg-history'),
    };
  }

  function clearTimer() {
    if (state.autoTimer) {
      clearTimeout(state.autoTimer);
      state.autoTimer = null;
    }
  }

  function syncToggles() {
    const { btnAuto, btnSkip } = els();
    if (btnAuto) {
      btnAuto.setAttribute('aria-pressed', String(state.auto));
      btnAuto.classList.toggle('on', state.auto);
    }
    if (btnSkip) {
      btnSkip.setAttribute('aria-pressed', String(state.skip));
      btnSkip.classList.toggle('on', state.skip);
    }
  }

  function push(speaker, text) {
    if (!text) return;
    const entry = { speaker: speaker || '旁白', text: String(text) };
    state.log.push(entry);
    state.stack.push(entry);
    if (state.log.length > 80) state.log.shift();
  }

  function renderHistory() {
    const { list } = els();
    if (!list) return;
    list.innerHTML = state.log
      .map(
        (e) =>
          `<div class="history-item"><p class="who">${escapeHtml(e.speaker)}</p><p class="msg">${escapeHtml(e.text)}</p></div>`
      )
      .join('');
    list.scrollTop = list.scrollHeight;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function openHistory(force) {
    const { panel } = els();
    if (!panel) return;
    const open = typeof force === 'boolean' ? force : panel.hidden;
    panel.hidden = !open;
    if (open) renderHistory();
  }

  function back() {
    if (state.stack.length <= 1) return null;
    state.stack.pop();
    return state.stack[state.stack.length - 1] || null;
  }

  function setAuto(v) {
    state.auto = !!v;
    if (state.auto) state.skip = false;
    clearTimer();
    syncToggles();
    if (state.auto && state.onAdvance) scheduleAuto();
  }

  function setSkip(v) {
    state.skip = !!v;
    if (state.skip) {
      state.auto = false;
      clearTimer();
      if (state.onAdvance) state.onAdvance();
    }
    syncToggles();
  }

  function toggleAuto() {
    setAuto(!state.auto);
    return state.auto;
  }

  function toggleSkip() {
    setSkip(!state.skip);
    return state.skip;
  }

  function scheduleAuto() {
    clearTimer();
    if (!state.auto || !state.onAdvance) return;
    const ms = Number(localStorage.getItem('hh_auto_ms') || '2200');
    state.autoTimer = setTimeout(() => {
      if (state.auto && state.onAdvance) state.onAdvance();
    }, state.skip ? 40 : Math.max(400, ms));
  }

  function onLineShown() {
    if (state.skip && state.onAdvance) {
      setTimeout(() => state.onAdvance && state.onAdvance(), 30);
      return;
    }
    if (state.auto) scheduleAuto();
  }

  function resetSession() {
    clearTimer();
    state.stack = [];
  }

  function clearAll() {
    resetSession();
    state.log = [];
    state.auto = false;
    state.skip = false;
    syncToggles();
    openHistory(false);
  }

  function bind(onAdvance) {
    state.onAdvance = onAdvance;
    const { btnAuto, btnSkip, btnBack, btnHist, panel } = els();
    if (btnAuto) btnAuto.onclick = () => toggleAuto();
    if (btnSkip) btnSkip.onclick = () => toggleSkip();
    if (btnHist) btnHist.onclick = () => openHistory();
    if (btnBack) {
      btnBack.onclick = () => {
        const prev = back();
        if (!prev) return;
        const nameEl = document.getElementById('dlg-name');
        const textEl = document.getElementById('dlg-text');
        if (nameEl) nameEl.textContent = prev.speaker;
        if (textEl) textEl.textContent = prev.text;
      };
    }
    const close = document.getElementById('historyClose');
    if (close) close.onclick = () => openHistory(false);
    if (panel) {
      panel.addEventListener('click', (e) => {
        if (e.target === panel) openHistory(false);
      });
    }
    syncToggles();
  }

  window.DialogueShell = {
    bind,
    push,
    back,
    setAuto,
    setSkip,
    toggleAuto,
    toggleSkip,
    openHistory,
    onLineShown,
    resetSession,
    clearAll,
    isAuto: () => state.auto,
    isSkip: () => state.skip,
    getLog: () => state.log.slice(),
  };
})();
