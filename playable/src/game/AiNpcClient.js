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
