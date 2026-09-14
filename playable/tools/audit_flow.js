/**
 * Headless flow + asset audit for Day1–7
 * node tools/audit_flow.js
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const issues = [];
const warns = [];

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function must(rel, why) {
  if (!exists(rel)) issues.push(`MISSING ${rel} (${why})`);
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}

const nodeFiles = [
  'data/day1.nodes.json',
  'data/day2.nodes.json',
  'data/day3.nodes.json',
  'data/day4.nodes.json',
  'data/day5.nodes.json',
  'data/day6.nodes.json',
  'data/day7.nodes.json',
  'data/visit.nodes.json',
];
const nodes = {};
nodeFiles.forEach((f) => Object.assign(nodes, readJson(f)));
const rooms = readJson('data/rooms.json');
const hotspots = readJson('data/hotspots.json');
const npcs = readJson('data/npcs.json');
const prompts = readJson('prompts/npc_stages.json');
const visitFloors = readJson('data/visit_floors.json');

[
  'assets/bg/bg_xuanguan_day.png',
  'assets/bg/bg_living_dirty.png',
  'assets/bg/bg_kitchen_day.png',
  'assets/bg/bg_bedroom_day.png',
  'assets/bg/bg_bathroom.png',
  'assets/bg/bg_corridor_visit.png',
  'assets/bg/bg_otherworld_gates.png',
  'assets/char/ningnian_idle.png',
  'assets/char/sisi_idle.png',
  'assets/char/boss_idle.png',
  'assets/char/liuaiguo_idle.png',
  'assets/char/licuilan_idle.png',
  'assets/prop/cucumber_mask.png',
  'assets/prop/snakeskin_sack.png',
  'assets/prop/cleaver.png',
  'assets/portrait/yeye_front.png',
  'assets/portrait/nainai_front.png',
  'play.html',
  'src/main.js',
].forEach((f) => must(f, 'required'));

Object.values(rooms).forEach((r) => {
  must(`assets/bg/${r.bg}.png`, `room ${r.id}`);
  if (r.bgNight) must(`assets/bg/${r.bgNight}.png`, `room night ${r.id}`);
});

Object.values(visitFloors).forEach((f) => {
  if (f.node && !nodes[f.node]) issues.push(`visit floor missing node ${f.node}`);
});

function getPath(state, path) {
  return path.split('.').reduce((cur, key) => (cur == null ? undefined : cur[key]), state);
}

function whenPass(when, state) {
  if (!when || typeof when !== 'object') return true;
  return Object.entries(when).every(([p, expect]) => {
    if (p === 'horrorGte') return (Number(state.horror) || 0) >= expect;
    if (p === 'horrorLt') return (Number(state.horror) || 0) < expect;
    if (p === 'visitCardsGte') return (Number(state.visitCards) || 0) >= expect;
    if (p === 'visitCardsLt') return (Number(state.visitCards) || 0) < expect;
    const v = getPath(state, p);
    if (expect && typeof expect === 'object' && !Array.isArray(expect)) {
      if (expect.gte != null) return Number(v) >= expect.gte;
      if (expect.lte != null) return Number(v) <= expect.lte;
    }
    if (typeof expect === 'boolean') return !!v === expect;
    return v === expect;
  });
}

function applyEffects(state, effects = {}) {
  Object.entries(effects).forEach(([p, value]) => {
    if (p === 'horrorReason') return;
    if (p === 'horror') {
      state.horror = Math.max(0, Math.min(100, (state.horror || 0) + (Number(value) || 0)));
      return;
    }
    if (p === 'visitCards') {
      state.visitCards = Math.max(0, (state.visitCards || 0) + (Number(value) || 0));
      return;
    }
    const parts = p.split('.');
    if (parts.length === 2) {
      const [a, b] = parts;
      if (!state[a] || typeof state[a] !== 'object') state[a] = {};
      if (typeof state[a][b] === 'number' && typeof value === 'number') {
        state[a][b] = Math.max(0, state[a][b] + value);
      } else {
        state[a][b] = value;
      }
    } else {
      state[p] = value;
    }
  });
}

Object.values(nodes).forEach((n) => {
  if (!rooms[n.room]) issues.push(`node ${n.id} bad room ${n.room}`);
  (n.showNpcs || []).forEach((id) => {
    if (!npcs[id]) issues.push(`node ${n.id} bad npc ${id}`);
  });
  const allChoices = [
    ...(n.choices || []),
    ...((n.onApproach && n.onApproach.choices) || []),
  ];
  allChoices.forEach((c) => {
    if (c.next && !nodes[c.next]) issues.push(`node ${n.id} bad next ${c.next}`);
    const dead = !c.next && !c.showEnd && !c.returnVisit && !c.unlockMove;
    if (dead && c.next !== null) issues.push(`node ${n.id} choice「${c.text}」无出口`);
  });
  if (n.storyNext && !nodes[n.storyNext]) issues.push(`node ${n.id} bad storyNext`);
  if (n.endNext && !nodes[n.endNext]) issues.push(`node ${n.id} bad endNext ${n.endNext}`);
  if (n.aiStage && !prompts.stages[n.aiStage]) issues.push(`node ${n.id} bad aiStage ${n.aiStage}`);
  const pose = n.npcPose || {};
  Object.entries(pose).forEach(([id, p]) => {
    if (p.sprite) must(`assets/char/${p.sprite}.png`, `${n.id} pose ${id}`);
  });
  const lines = [...(n.dialogue || []), ...(n.briefing || []), ...(n.intro || [])];
  lines.forEach((line) => {
    if (line.portrait) must(`assets/portrait/${line.portrait}.png`, `${n.id} portrait`);
  });
});

hotspots.forEach((h) => {
  if (!rooms[h.room]) issues.push(`hotspot ${h.id} bad room`);
  if (h.prop && !exists(`assets/prop/${h.prop}.png`)) warns.push(`hotspot prop missing ${h.prop}`);
});

const state = {
  horror: 0,
  visitCards: 0,
  visitReturnNode: '',
  familyTrust: { sisi: 0, boss: 0, liuaiguo: 0, licuilan: 0 },
  inventory: { mop: false, towel: false, ateStrangeFood: false, cleaver: false, faceMask: false },
  flags: {},
  clues: {},
};

function pickExit(n, state) {
  if (n.floorBar) {
    state.visitReturnNode = n.id;
    state._visitSim = (state._visitSim || 0) + 1;
    if (state._visitSim > 2) {
      const flag = n.visitHomeFlag;
      const dest = (flag && state.flags?.[flag] && n.visitHomeAlt)
        ? n.visitHomeAlt
        : (n.visitHomeNode || n.visitHomeAlt || 'D4-HOME');
      return { type: 'visitHome', next: dest };
    }
    const day = Number(state.day) || Number(n.visitDayMin) || 4;
    const floors = Object.entries(visitFloors)
      .map(([floor, info]) => ({ floor, ...info }))
      .filter((f) => (Number(f.dayMin) || 1) <= day && !f.meetOnly)
      .sort((a, b) => Number(b.floor) - Number(a.floor));
    const pick = floors.find((f) => !(f.visitFlag && state.flags[f.visitFlag])) || floors[0];
    if (pick?.node) {
      state.floor = Number(pick.floor);
      return { type: 'floor', next: pick.node };
    }
    return { type: 'visitHome', next: n.visitHomeNode || 'D4-HOME' };
  }
  if (n.nextOnDoor) {
    const dest = Object.values(n.nextOnDoor)[0];
    if (dest === '__VISIT_HOME__') {
      return { type: 'visitHome', next: n.visitHomeNode || 'D4-HOME' };
    }
    return { type: 'door', next: dest };
  }
  const approach = (n.onApproach?.choices || []).find((c) => whenPass(c.when, state) && c.next);
  if (approach) return { type: 'approach', next: approach.next, effects: approach.effects };
  if (n.storyNext) return { type: 'story', next: n.storyNext };
  const list = (n.choices || []).filter((c) => whenPass(c.when, state));
  // 正史模拟：优先认家/通关，避开「想留下」「黑雾」「伏击失败」
  const rank = (c) => {
    const t = c.text || '';
    const nx = c.next || '';
    if (nx === 'END_STAY' && state.flags?.stayedBehindAttempt) return 0;
    if (nx === 'END_HUNTER' && state.flags?.hunterTrack) return 0;
    if (nx === 'END_FRIENDS' && state.flags?.sharedCards) return 0;
    if (nx === 'END_CLEAR') {
      if (state.flags?.stayedBehindAttempt || state.flags?.hunterTrack || state.flags?.sharedCards) return 4;
      return 0;
    }
    if (c.effects && c.effects['flags.acceptedHeartKey'] === true) return 1;
    if (c.effects && c.effects['flags.gotCleaver'] === true) return 1;
    if (c.effects && c.effects['flags.grandmaFaceMask'] === true) return 1;
    if (/打开|接过|敷面膜|组队|分给|亮刀|接住/.test(t)) return 2;
    if (/留下|雾|抢光|硬刚|怪物|掀桌|独吞|反水/.test(t)) return 9;
    if (/END_FOG|END_AMBUSH|END_STAY|END_NOKEY|END_HUNTER/.test(nx)) return 8;
    if (nx) return 3;
    return 5;
  };
  const sorted = list.slice().sort((a, b) => rank(a) - rank(b));
  const withNext = sorted.find((c) => c.next);
  if (withNext) return { type: 'choice', next: withNext.next, effects: withNext.effects };
  const ret = list.find((c) => c.returnVisit);
  if (ret) {
    return {
      type: 'return',
      next: state.visitReturnNode || (state.day >= 5 ? 'FREE_VISIT_D5' : 'FREE_VISIT_D4'),
      effects: ret.effects,
    };
  }
  const end = list.find((c) => c.showEnd);
  if (end && n.endNext) return { type: 'endNext', next: n.endNext, effects: end.effects };
  return { type: 'stop', next: null };
}

const pathIds = [];
let cur = 'P04';
const guard = new Set();
const softReenter = new Set();
while (cur && pathIds.length < 120) {
  const n = nodes[cur];
  if (!n) {
    issues.push(`sim hit missing node ${cur}`);
    break;
  }
  if (guard.has(cur)) {
    if (n.floorBar && !softReenter.has(cur)) {
      softReenter.add(cur);
      state._visitSim = 99;
    } else {
      break;
    }
  } else {
    guard.add(cur);
  }
  pathIds.push(cur);
  if (n.onEnter) {
    Object.entries(n.onEnter).forEach(([k, v]) => {
      if (k !== 'horror' && k !== 'horrorReason') state[k] = v;
    });
  }
  const exit = pickExit(n, state);
  if (exit.effects) applyEffects(state, exit.effects);
  cur = exit.next;
}

const required = [
  'P04', 'D1-01', 'FREE_D1', 'END_DAY1',
  'D2-00', 'D2-04', 'FREE_D2', 'END_DAY2',
  'D3-00', 'D3-03', 'END_DAY3',
  'D4-00', 'FREE_VISIT_D4', 'END_DAY4',
  'D5-00', 'FREE_VISIT_D5', 'END_DAY5',
  'D6-00', 'END_DAY6',
  'D7-00', 'END_CLEAR',
];
required.forEach((id) => {
  if (!pathIds.includes(id)) issues.push(`main path missing ${id}; got ${pathIds.join('>')}`);
});

['FREE_VISIT_D4', 'FREE_VISIT_D5', 'D7-AMBUSH', 'END_STAY', 'END_FRIENDS', 'END_HUNTER', 'END_AMBUSH'].forEach((id) => {
  if (!nodes[id]) issues.push(`missing feature node ${id}`);
});

const dayStarts = ['D2-00', 'D3-00', 'D4-00', 'D5-00', 'D6-00', 'D7-00'];
dayStarts.forEach((id) => {
  if (!nodes[id]) issues.push(`missing day start ${id}`);
});

function simulateFrom(startId, patch) {
  const s = {
    horror: 0,
    visitCards: 0,
    visitReturnNode: '',
    day: patch.day || 1,
    familyTrust: { sisi: 0, boss: 0, liuaiguo: 0, licuilan: 0 },
    inventory: { mop: false, towel: false, ateStrangeFood: false, cleaver: false, faceMask: false },
    flags: {},
    clues: {},
    ...patch,
    flags: { ...(patch.flags || {}) },
    inventory: { mop: false, towel: false, ateStrangeFood: false, cleaver: false, faceMask: false, ...(patch.inventory || {}) },
  };
  const ids = [];
  let c = startId;
  const seen = new Set();
  while (c && !seen.has(c) && ids.length < 80) {
    seen.add(c);
    ids.push(c);
    const n = nodes[c];
    if (!n) return { ids, error: `missing ${c}`, state: s };
    if (n.onEnter) {
      Object.entries(n.onEnter).forEach(([k, v]) => {
        if (k !== 'horror' && k !== 'horrorReason') s[k] = v;
      });
    }
    const exit = pickExit(n, s);
    if (exit.effects) applyEffects(s, exit.effects);
    c = exit.next;
  }
  return { ids, state: s };
}

const refuse = simulateFrom('D2-04x', { flags: { refuseMother: true }, horror: 40 });
if (!refuse.ids.includes('FREE_D2')) {
  issues.push(`D2-04x must flow to FREE_D2, got ${refuse.ids.join('>')}`);
}
const fog = simulateFrom('D7-05', { flags: { refusedHeartKey: true, acceptedHeartKey: false } });
if (!fog.ids.includes('END_FOG')) {
  issues.push(`拒献心应到 END_FOG，got ${fog.ids.join('>')}`);
}
const ambush = simulateFrom('D7-AMBUSH', {
  day: 7,
  inventory: { cleaver: true },
  flags: { hongjieSpared: true },
});
if (!ambush.ids.includes('D7-02') && !ambush.ids.includes('END_AMBUSH')) {
  issues.push(`D7-AMBUSH should reach D7-02 or END_AMBUSH, got ${ambush.ids.join('>')}`);
}
const stay = simulateFrom('D7-06', {
  day: 7,
  flags: { stayedBehindAttempt: true, hunterTrack: false, sharedCards: false },
});
if (!stay.ids.includes('END_STAY')) {
  issues.push(`E5 path missing END_STAY, got ${stay.ids.join('>')}`);
}

console.log('PATH', pathIds.join(' -> '));
console.log('SIM', `horror=${state.horror} cards=${state.visitCards} cleaver=${state.inventory.cleaver}`);
console.log('REFUSE', refuse.ids.join(' -> '));
console.log('AMBUSH', ambush.ids.join(' -> '));
console.log('E5', stay.ids.join(' -> '));
console.log('ISSUES', issues.length ? issues : 'none');
console.log('WARNS', warns.length ? warns : 'none');
process.exit(issues.length ? 1 : 0);
