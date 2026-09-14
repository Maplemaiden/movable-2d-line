/**
 * Gal 式立绘站位：左右站在对话框后方，说话者高亮，另一侧压暗。
 */
(() => {
  const DEFAULTS = {
    sisi: 'sisi_front',
    sisi_red: 'sisi_blood_front',
    boss: 'boss_front',
    ningnian: 'ningnian_front',
    liuaiguo: 'yeye_front',
    licuilan: 'nainai_front',
    yeye: 'yeye_front',
    nainai: 'nainai_front',
  };

  const ALIASES = {
    秦思思: 'sisi',
    思思: 'sisi',
    '？？？': 'boss',
    断头: 'boss',
    宁念: 'ningnian',
    刘爱国: 'liuaiguo',
    李翠兰: 'licuilan',
    肠大爷: 'yeye',
    黑老太: 'nainai',
    红姐: 'ningnian',
    俊哥: null,
    苏小茉: null,
    方远: null,
    邻家: null,
    '？': null,
    旁白: null,
    system: null,
    系统: null,
    danmaku: null,
    弹幕: null,
  };

  const NPC_SIDE = {
    sisi: 'left',
    boss: 'left',
    liuaiguo: 'left',
    licuilan: 'left',
    yeye: 'left',
    nainai: 'left',
    ningnian: 'right',
  };

  let currentSlots = [];

  function els() {
    return {
      left: document.getElementById('vn-char-left'),
      right: document.getElementById('vn-char-right'),
      leftImg: document.querySelector('#vn-char-left img'),
      rightImg: document.querySelector('#vn-char-right img'),
      stage: document.getElementById('vn-stage-chars'),
    };
  }

  function resolveKey(speaker, line = {}) {
    if (line.portrait) return String(line.portrait).replace(/\.png$/, '');
    if (line.sprite && !String(line.sprite).includes('/') && /front|angry|phone|soothe|sew|protect|head|chest|mask|enter|patched|blood|hug|daily/.test(line.sprite)) {
      return String(line.sprite).replace(/\.png$/, '');
    }
    const sp = ALIASES[speaker] !== undefined ? ALIASES[speaker] : speaker;
    if (sp == null) return null;
    return DEFAULTS[sp] || null;
  }

  function resolveSide(speaker, line = {}) {
    if (line.side === 'left' || line.side === 'right') return line.side;
    const sp = ALIASES[speaker] !== undefined ? ALIASES[speaker] : speaker;
    return NPC_SIDE[sp] || 'left';
  }

  function setSlot(side, key, { dim = false, visible = true } = {}) {
    const { left, right, leftImg, rightImg } = els();
    const wrap = side === 'right' ? right : left;
    const img = side === 'right' ? rightImg : leftImg;
    if (!wrap || !img) return;
    if (!visible || !key) {
      wrap.classList.remove('is-visible', 'is-dim', 'is-focus');
      return;
    }
    img.src = `./assets/portrait/${key}.png?v=${window.HH_CONFIG?.assetVer || '1'}`;
    img.alt = key;
    wrap.classList.add('is-visible');
    wrap.classList.toggle('is-dim', !!dim);
    wrap.classList.toggle('is-focus', !dim);
  }

  function applySlots(slots, focusSide) {
    const bySide = { left: null, right: null };
    (slots || []).forEach((s) => {
      if (!s?.sprite && !s?.portrait) return;
      const side = s.side || 'left';
      const key = String(s.portrait || s.sprite).replace(/^.*\//, '').replace(/\.png$/, '');
      bySide[side] = key;
    });
    setSlot('left', bySide.left, {
      visible: !!bySide.left,
      dim: focusSide ? focusSide !== 'left' : false,
    });
    setSlot('right', bySide.right, {
      visible: !!bySide.right,
      dim: focusSide ? focusSide !== 'right' : false,
    });
    const stage = els().stage;
    if (stage) stage.classList.toggle('has-chars', !!(bySide.left || bySide.right));
  }

  function show(speaker, line = {}) {
    if (line.clearSprites) {
      currentSlots = [];
      hide();
      return;
    }

    if (Array.isArray(line.slots) && line.slots.length) {
      currentSlots = line.slots.map((s) => ({
        side: s.side || 'left',
        portrait: s.portrait || s.sprite,
        name: s.name,
      }));
      const focus = line.focusSide || resolveSide(speaker, line);
      applySlots(currentSlots, focus);
      return;
    }

    const key = resolveKey(speaker, line);
    if (!key) {
      // 旁白/系统：保留当前立绘但全部压暗
      if (currentSlots.length) applySlots(currentSlots, null);
      const { left, right } = els();
      left?.classList.add('is-dim');
      right?.classList.add('is-dim');
      left?.classList.remove('is-focus');
      right?.classList.remove('is-focus');
      return;
    }

    const side = resolveSide(speaker, line);
    const others = currentSlots.filter((s) => s.side !== side);
    currentSlots = [...others, { side, portrait: key, name: speaker }];
    applySlots(currentSlots, side);
  }

  function hide() {
    currentSlots = [];
    setSlot('left', null, { visible: false });
    setSlot('right', null, { visible: false });
    els().stage?.classList.remove('has-chars');
  }

  // 兼容旧名
  window.PortraitUI = { show, hide, resolveKey, DEFAULTS };
  window.GalStandUI = window.PortraitUI;
})();
