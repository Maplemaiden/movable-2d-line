/**
 * Headless flow + asset audit for Day1
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

const nodes = JSON.parse(fs.readFileSync(path.join(root, 'data/day1.nodes.json'), 'utf8'));
const rooms = JSON.parse(fs.readFileSync(path.join(root, 'data/rooms.json'), 'utf8'));
const hotspots = JSON.parse(fs.readFileSync(path.join(root, 'data/hotspots.json'), 'utf8'));
const npcs = JSON.parse(fs.readFileSync(path.join(root, 'data/npcs.json'), 'utf8'));
const prompts = JSON.parse(fs.readFileSync(path.join(root, 'prompts/npc_stages.json'), 'utf8'));

// assets
[
  'assets/bg/bg_xuanguan_day.png',
  'assets/bg/bg_living_day.png',
  'assets/bg/bg_living_night.png',
  'assets/bg/bg_kitchen_day.png',
  'assets/bg/bg_bedroom_day.png',
  'assets/bg/bg_bedroom_night.png',
  'assets/bg/bg_bathroom.png',
  'assets/char/ningnian_idle.png',
  'assets/char/ningnian_walk1.png',
  'assets/char/ningnian_walk2.png',
  'assets/char/sisi_idle.png',
  'assets/char/sisi_walk1.png',
  'assets/char/sisi_walk2.png',
  'assets/char/sisi_red_idle.png',
  'assets/char/sisi_hug.png',
  'assets/char/boss_idle.png',
  'assets/char/boss_walk1.png',
  'assets/char/boss_walk2.png',
  'assets/prop/mop.png',
  'assets/prop/towel.png',
  'assets/prop/red_dress.png',
  'assets/prop/meat_dish.png',
  'assets/audio/door.wav',
  'assets/audio/ui_click.wav',
  'assets/audio/sting_low.wav',
  'assets/audio/pickup.wav',
  'assets/audio/step.wav',
  'play.html',
  'src/main.js',
].forEach((f) => must(f, 'required'));

Object.values(rooms).forEach((r) => {
  must(`assets/bg/${r.bg}.png`, `room ${r.id}`);
  if (r.bgNight) must(`assets/bg/${r.bgNight}.png`, `room night ${r.id}`);
});

Object.values(nodes).forEach((n) => {
  if (!rooms[n.room]) issues.push(`node ${n.id} bad room ${n.room}`);
  (n.showNpcs || []).forEach((id) => {
    if (!npcs[id]) issues.push(`node ${n.id} bad npc ${id}`);
  });
  (n.choices || []).forEach((c) => {
    if (c.next && !nodes[c.next]) issues.push(`node ${n.id} bad next ${c.next}`);
  });
  if (n.storyNext && !nodes[n.storyNext]) issues.push(`node ${n.id} bad storyNext`);
  if (n.aiStage && !prompts.stages[n.aiStage]) issues.push(`node ${n.id} bad aiStage ${n.aiStage}`);
  if (n.onApproach?.choices) {
    n.onApproach.choices.forEach((c) => {
      if (c.next && !nodes[c.next]) issues.push(`approach ${n.id} bad next ${c.next}`);
    });
  }
  const pose = n.npcPose || {};
  Object.entries(pose).forEach(([id, p]) => {
    if (p.sprite) must(`assets/char/${p.sprite}.png`, `${n.id} pose ${id}`);
  });
});

hotspots.forEach((h) => {
  if (!rooms[h.room]) issues.push(`hotspot ${h.id} bad room`);
  if (h.prop) {
    if (!exists(`assets/prop/${h.prop}.png`)) warns.push(`hotspot prop missing ${h.prop}`);
  }
});

// simulate path
const pathIds = [];
let cur = 'P04';
const guard = new Set();
while (cur && !guard.has(cur)) {
  guard.add(cur);
  pathIds.push(cur);
  const n = nodes[cur];
  if (n.nextOnDoor) cur = Object.values(n.nextOnDoor)[0];
  else if (n.onApproach?.choices?.[0]?.next) cur = n.onApproach.choices[0].next;
  else if (n.storyNext) cur = n.storyNext;
  else if (n.choices?.find((c) => c.next)) cur = n.choices.find((c) => c.next).next;
  else cur = null;
}

const required = ['P04', 'D1-01', 'D1-02', 'D1-03', 'D1-03b', 'FREE_D1', 'D1-04', 'D1-04b', 'D1-05', 'END_DAY1'];
required.forEach((id) => {
  if (!pathIds.includes(id)) issues.push(`main path missing ${id}, got ${pathIds.join('>')}`);
});

console.log('PATH', pathIds.join(' -> '));
console.log('ISSUES', issues.length ? issues : 'none');
console.log('WARNS', warns.length ? warns : 'none');
process.exit(issues.length ? 1 : 0);
