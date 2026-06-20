const OpenAI = require('openai');
const config = require('../../config');

class DeepSeekAdapter {
  constructor() {
    this.client = new OpenAI({
      apiKey: config.deepseek.apiKey,
      baseURL: config.deepseek.baseURL,
    });
  }

  baseParams(options = {}) {
    return {
      model: config.deepseek.model,
      temperature: options.temperature ?? 0.85,
      max_tokens: options.max_tokens ?? 1024,
      extra_body: { thinking: { type: options.thinking ?? 'disabled' } },
    };
  }

  async chat(messages, options = {}) {
    try {
      const completion = await this.client.chat.completions.create({
        ...this.baseParams(options),
        messages,
        response_format: { type: 'json_object' },
      });
      const raw = completion.choices[0]?.message?.content || '{}';
      return JSON.parse(raw);
    } catch (err) {
      console.error('[deepseek] chat error:', err.message);
      return { say: '刚刚走神了，请再说一次。', play: [], reason: '模型调用失败', segue: '' };
    }
  }

  // 使用 DeepSeek 生成自然语言文本（例如 TTS 风格指令）
  async text(messages, options = {}) {
    try {
      const completion = await this.client.chat.completions.create({
        ...this.baseParams(options),
        messages,
      });
      return completion.choices[0]?.message?.content || '';
    } catch (err) {
      console.error('[deepseek] text error:', err.message);
      return '';
    }
  }
}

module.exports = DeepSeekAdapter;
