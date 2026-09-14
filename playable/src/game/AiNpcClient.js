/**
 * AI NPC 客户端：分阶段提示词 + API 占位
 * 灌密钥：localStorage.setItem('hh_api_key', 'sk-...') 后刷新
 */
class AiNpcClient {
  constructor(config, prompts) {
    this.config = config;
    this.prompts = prompts;
    this.stage = 'D1_MEET';
  }

  setStage(stage) {
    if (stage) this.stage = stage;
  }

  hasKey() {
    return !!(this.config.api.apiKey && this.config.api.apiKey.trim());
  }

  buildSystemPrompt(npcId) {
    const shared = this.prompts.shared;
    const stagePack = this.prompts.stages[this.stage] || {};
    const role = stagePack[npcId] || '你是幸福之家的诡异家人。';
    return [
      shared.world,
      shared.style,
      `玩家角色：${shared.player}`,
      `当前阶段：${this.stage}`,
      `你的角色设定：${role}`,
      '用中文回复，1-3句，不要换行太长。',
    ].join('\n');
  }

  fallback(npcId) {
    const list = (this.prompts.fallback && this.prompts.fallback[npcId]) || ['……'];
    return list[Math.floor(Math.random() * list.length)];
  }

  /** 无密钥时的温和启发式评判 */
  heuristicJudge(history = []) {
    const blob = (history || []).map((m) => m.content || '').join('\n');
    let delta = 0;
    if (/怪物|杀了|血迹真相|好可怕|滚开|走开|恶心|不是人|诡异/.test(blob)) delta += 2;
    if (/害怕|恐惧|别靠近|你是什么/.test(blob)) delta += 1;
    if (/妈妈|家人|吃饭|睡觉|抱抱|擦脸|照顾|喜欢你|没事了|晚安/.test(blob)) delta -= 2;
    if (/一起|回家|做饭|漂亮|可爱/.test(blob)) delta -= 1;
    delta = Math.max(-3, Math.min(3, delta));
    const reason = delta > 0
      ? '对话里疏远/恐惧语气偏多，惊悚微升'
      : delta < 0
        ? '对话偏认家照顾，惊悚微降'
        : '闲聊无大波澜，惊悚不变';
    return { delta, reason };
  }

  clampJudge(raw) {
    let delta = Number(raw?.delta);
    if (!Number.isFinite(delta)) delta = 0;
    delta = Math.round(delta);
    delta = Math.max(-4, Math.min(4, delta));
    const reason = String(raw?.reason || '').trim().slice(0, 48)
      || (delta ? '对话结束：惊悚微调' : '对话结束：惊悚不变');
    return { delta, reason };
  }

  /**
   * 会话结束时评判惊悚：仅小幅 ±0~4
   * @returns {Promise<{delta:number, reason:string, ok:boolean}>}
   */
  async judgeHorror(npcId, history = []) {
    const turns = (history || []).filter((m) => m.role === 'user').length;
    if (turns < 1) return { delta: 0, reason: '', ok: true };

    if (!this.config.api.enabled || !this.hasKey()) {
      return { ...this.clampJudge(this.heuristicJudge(history)), ok: false };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(this.config.api.timeoutMs || 8000, 6000));
    try {
      const transcript = history.slice(-8).map((m) => `${m.role === 'user' ? '宁念' : '对方'}：${m.content}`).join('\n');
      const messages = [
        {
          role: 'system',
          content: [
            '你是「幸福之家」副本的惊悚值裁判（不是角色）。',
            '惊悚值衡量玩家把诡异当家人的程度：认家/照顾/日常闲聊应下降；追问血腥真相/驱赶/当怪物应上升；无关闲聊为 0。',
            '只输出一行 JSON，不要其它文字：{"delta":整数,"reason":"简短中文"}',
            'delta 必须在 -3 到 +3 之间（温和波动，禁止剧烈）。',
            `当前阶段：${this.stage}；对方 NPC：${npcId}`,
          ].join('\n'),
        },
        {
          role: 'user',
          content: `根据以下对话评判惊悚变化：\n${transcript}`,
        },
      ];
      const res = await fetch(`${this.config.api.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.api.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.api.model,
          messages,
          temperature: 0.2,
          max_tokens: 80,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim() || '';
      const match = text.match(/\{[\s\S]*\}/);
      const parsed = match ? JSON.parse(match[0]) : {};
      return { ...this.clampJudge(parsed), ok: true };
    } catch (e) {
      return { ...this.clampJudge(this.heuristicJudge(history)), ok: false };
    } finally {
      clearTimeout(timer);
    }
  }

  async chat(npcId, userText, history = []) {
    if (!this.config.api.enabled || !this.hasKey()) {
      return { ok: false, text: this.fallback(npcId), reason: 'no_key' };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.api.timeoutMs);
    try {
      const messages = [
        { role: 'system', content: this.buildSystemPrompt(npcId) },
        ...history.slice(-6),
        { role: 'user', content: userText },
      ];
      const res = await fetch(`${this.config.api.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.api.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.api.model,
          messages,
          temperature: 0.7,
          max_tokens: 180,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content?.trim() || this.fallback(npcId);
      return { ok: true, text };
    } catch (e) {
      return { ok: false, text: this.fallback(npcId), reason: String(e.message || e) };
    } finally {
      clearTimeout(timer);
    }
  }
}

window.AiNpcClient = AiNpcClient;
