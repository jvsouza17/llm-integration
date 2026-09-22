const { LLMProvider } = require('./llmProvider');

class GroqProvider extends LLMProvider {
  constructor({ apiKey, embeddingProvider, model = 'llama-3.1-8b-instant' }) {
    super();
    if (!apiKey) throw new Error('GROQ_API_KEY não configurada');
    if (!embeddingProvider || typeof embeddingProvider.embed !== 'function') {
      throw new Error('Provider de embeddings não configurado para o Groq');
    }
    this.apiKey = apiKey;
    this.embeddingProvider = embeddingProvider;
    this.model = model;
  }

  async embed(text) {
    return this.embeddingProvider.embed(text);
  }

  async generate(prompt) {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
      }),
    });

    if (!response.ok) {
      throw new Error(`Groq retornou HTTP ${response.status}`);
    }

    const result = await response.json();
    return result.choices?.[0]?.message?.content || '';
  }

  getModelInfo() {
    const embeddingInfo = typeof this.embeddingProvider.getModelInfo === 'function'
      ? this.embeddingProvider.getModelInfo()
      : {};
    return {
      provider: 'groq',
      configuredModel: this.model,
      name: this.model,
      embeddingModel: embeddingInfo.embeddingModel || 'unknown',
      fallbackUsed: false,
      fallbacksEnabled: false,
    };
  }
}

module.exports = { GroqProvider };
