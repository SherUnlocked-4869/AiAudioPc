require('dotenv').config();

// Claudio 配置中心
// 密钥请放在 .env 文件中，不要提交到版本控制

module.exports = {
  port: process.env.PORT || 8080,

  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
  },

  mimo: {
    apiKey: process.env.MIMO_API_KEY,
    baseURL: process.env.MIMO_BASE_URL || 'https://api.xiaomimimo.com/v1',
    model: process.env.MIMO_MODEL || 'mimo-v2.5-tts',
    voice: process.env.MIMO_VOICE || '冰糖',
    format: 'wav',
  },

  paths: {
    user: './user',
    prompts: './prompts',
    cache: './cache',
    data: './data',
  },
};
