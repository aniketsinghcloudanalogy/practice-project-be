const axios = require('axios');
const config = require('../config');

let groqClient = null;

if (config.GROQ_API_KEY) {
  try {
    groqClient = axios.create({
      baseURL: 'https://api.groq.com/openai/v1',
      headers: {
        Authorization: `Bearer ${config.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    });

    // Attach a convenience method for chat completions
    groqClient.chat = async (prompt, { system, maxTokens, jsonMode } = {}) => {
      const messages = [];
      if (system) messages.push({ role: 'system', content: system });
      messages.push({ role: 'user', content: prompt });

      const body = {
        model: config.GROQ_MODEL,
        messages,
        temperature: 0.7,
        max_tokens: maxTokens || config.GROQ_MAX_TOKENS,
      };
      if (jsonMode) body.response_format = { type: 'json_object' };

      const res = await groqClient.post('/chat/completions', body);
      const content = res.data?.choices?.[0]?.message?.content;
      if (!content) throw new Error('Empty response from Groq');
      return content;
    };

    console.log('[DealReg] Groq configured as primary AI');
  } catch (e) {
    console.warn('[DealReg] Groq setup failed:', e.message);
  }
}

module.exports = groqClient;
