const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../../config');

class TTS {
  constructor() {
    this.client = new OpenAI({
      apiKey: config.mimo.apiKey,
      baseURL: config.mimo.baseURL,
    });
    this.cacheDir = path.join(config.paths.cache, 'tts');
    fs.mkdirSync(this.cacheDir, { recursive: true });
  }

  hash(text, voice) {
    return crypto.createHash('md5').update(`${voice}:${text}`).digest('hex');
  }

  // 非流式合成，返回缓存文件路径
  async synthesize(text, styleInstruction = '') {
    const cacheKey = this.hash(text, `${config.mimo.voice}:${styleInstruction}`);
    const cachePath = path.join(this.cacheDir, `${cacheKey}.wav`);

    if (fs.existsSync(cachePath)) {
      console.log('[tts] cache hit:', cacheKey);
      return cachePath;
    }

    try {
      const messages = [
        {
          role: 'user',
          content: styleInstruction || '温暖、自然、像深夜电台 DJ 一样播报，语速适中，带一点亲切感。',
        },
        {
          role: 'assistant',
          content: text,
        },
      ];

      const completion = await this.client.chat.completions.create({
        model: config.mimo.model,
        messages,
        audio: {
          format: config.mimo.format,
          voice: config.mimo.voice,
        },
      });

      const audioData = completion.choices[0]?.message?.audio?.data;
      if (!audioData) {
        throw new Error('no audio data returned');
      }

      const buffer = Buffer.from(audioData, 'base64');
      fs.writeFileSync(cachePath, buffer);
      console.log('[tts] synthesized:', cacheKey, buffer.length, 'bytes');
      return cachePath;
    } catch (err) {
      console.error('[tts] synthesize error:', err.message);
      return null;
    }
  }

  // 流式合成（返回 base64 chunk 流）
  async *stream(text, styleInstruction = '') {
    try {
      const messages = [
        {
          role: 'user',
          content: styleInstruction || '温暖、自然、像深夜电台 DJ 一样播报，语速适中，带一点亲切感。',
        },
        {
          role: 'assistant',
          content: text,
        },
      ];

      const stream = await this.client.chat.completions.create({
        model: config.mimo.model,
        messages,
        audio: {
          format: 'pcm16',
          voice: config.mimo.voice,
        },
        stream: true,
      });

      for await (const chunk of stream) {
        const audio = chunk.choices?.[0]?.delta?.audio;
        if (audio && audio.data) {
          yield { type: 'chunk', data: audio.data };
        }
      }
    } catch (err) {
      console.error('[tts] stream error:', err.message);
      yield { type: 'error', message: err.message };
    }
  }

  cachePath(hash) {
    return path.join(this.cacheDir, `${hash}.wav`);
  }
}

module.exports = TTS;
