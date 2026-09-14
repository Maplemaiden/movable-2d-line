/**
 * 简易 BGM：按场景/情绪切曲，尊重静音与音量。
 */
(() => {
  const TRACKS = {
    ambient: 'assets/bgm/jorisvermeer-creepy-game-background-397275.mp3',
    home: 'assets/bgm/universfield-spooky-music-box-513554.mp3',
    tension: 'assets/bgm/alex-morgan-ambient-horror-creepy-atmosphere-dark-587402.mp3',
    dark: 'assets/bgm/echoes_of_lumen-horror-ambient-dark-atmosphere-586983.mp3',
    night: 'assets/bgm/leberch-horror-music-box-585986.mp3',
    comedy: 'assets/bgm/freedom_ai_studio-boo-honk-cartoon-comedy-horror-590142.mp3',
  };

  const ROOM_MOOD = {
    room_xuanguan: 'tension',
    room_living: 'home',
    room_kitchen: 'home',
    room_bedroom: 'night',
    room_bathroom: 'ambient',
    room_corridor: 'tension',
    room_visit_hostile: 'tension',
    room_visit_friendly: 'home',
    room_visit_puzzle: 'dark',
    room_visit_empty: 'dark',
    room_gates: 'dark',
  };

  let audio = null;
  let currentKey = null;
  let muted = localStorage.getItem('hh_mute') === '1';
  let volume = Number(localStorage.getItem('hh_bgm_vol') || '0.35');
  let unlocked = false;

  function ensure() {
    if (!audio) {
      audio = new Audio();
      audio.loop = true;
      audio.preload = 'auto';
    }
    return audio;
  }

  function setMuted(v) {
    muted = !!v;
    localStorage.setItem('hh_mute', muted ? '1' : '0');
    if (audio) audio.muted = muted;
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, Number(v) || 0));
    localStorage.setItem('hh_bgm_vol', String(volume));
    if (audio) audio.volume = volume;
  }

  function unlock() {
    unlocked = true;
  }

  async function play(key) {
    if (!key || !TRACKS[key]) return;
    const a = ensure();
    if (currentKey === key && !a.paused) return;
    currentKey = key;
    a.src = TRACKS[key];
    a.volume = volume;
    a.muted = muted;
    if (!unlocked) return;
    try {
      await a.play();
    } catch (_) {
      /* 需用户手势后再播 */
    }
  }

  function playForRoom(roomId, { night = false } = {}) {
    if (night) return play('night');
    return play(ROOM_MOOD[roomId] || 'ambient');
  }

  function playMood(mood) {
    return play(mood);
  }

  function stop() {
    if (audio) {
      audio.pause();
      currentKey = null;
    }
  }

  window.BgmPlayer = {
    TRACKS,
    unlock,
    play,
    playForRoom,
    playMood,
    stop,
    setMuted,
    setVolume,
    isMuted: () => muted,
    getVolume: () => volume,
    getCurrent: () => currentKey,
  };
})();
