/* 明天把密钥填进 localStorage 或此处即可。不要提交真实密钥到公开仓库。 */
window.HH_CONFIG = {
  api: {
    // OpenAI 兼容接口占位；填好后刷新即可对话
    baseUrl: localStorage.getItem('hh_api_base') || 'https://api.openai.com/v1',
    apiKey: localStorage.getItem('hh_api_key') || '', // TODO: 明天灌密钥
    model: localStorage.getItem('hh_api_model') || 'gpt-4o-mini',
    enabled: true, // 无密钥时自动走兜底句
    timeoutMs: 8000,
  },
  saveKey: 'hh_movable_day1_v2',
  designWidth: 1920,
  designHeight: 1080,
  groundY: 980,
  interactRange: 160,
  playerSpeed: 320,
};
