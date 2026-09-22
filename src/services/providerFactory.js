const { GeminiProvider } = require('./geminiProvider');
const { GroqProvider } = require('./groqProvider');

function createProvider(env = process.env) {
  const embeddingProvider = new GeminiProvider(env.GEMINI_API_KEY);
  if ((env.LLM_PROVIDER || 'gemini').toLowerCase() === 'groq') {
    return new GroqProvider({
      apiKey: env.GROQ_API_KEY,
      embeddingProvider,
      model: env.GROQ_MODEL,
    });
  }
  return embeddingProvider;
}

module.exports = { createProvider };
