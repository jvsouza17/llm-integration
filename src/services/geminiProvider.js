const { GoogleGenerativeAI } = require('@google/generative-ai');
const { LLMProvider } = require('./llmProvider');

class GeminiProvider extends LLMProvider {
  constructor(apiKey, options = {}) {
    super();
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY não configurada');
    }
    this.client = options.client || new GoogleGenerativeAI(apiKey);
    this.embeddingModels = options.embeddingModels || [
      process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001',
    ];
    this.generationModels = options.generationModels || [
      process.env.GEMINI_GENERATION_MODEL || 'gemini-3.6-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.5-flash',
      'gemini-2.0-flash-lite',
    ];
    this.activeEmbeddingModel = null;
    this.activeGenerationModel = null;
  }

  async embed(text) {
    const models = this.activeEmbeddingModel
      ? [this.activeEmbeddingModel, ...this.embeddingModels.filter((model) => model !== this.activeEmbeddingModel)]
      : this.embeddingModels;

    for (const modelName of models) {
      try {
        const model = this.client.getGenerativeModel({ model: modelName });
        const result = await model.embedContent(text);
        this.activeEmbeddingModel = modelName;
        return result.embedding.values;
      } catch (error) {
        if (!isModelFallbackError(error) || modelName === models[models.length - 1]) throw error;
      }
    }
  }

  async generate(prompt) {
    const models = this.activeGenerationModel
      ? [this.activeGenerationModel, ...this.generationModels.filter((model) => model !== this.activeGenerationModel)]
      : this.generationModels;

    for (const modelName of models) {
      try {
        const model = this.client.getGenerativeModel({ model: modelName });
        const response = await model.generateContent(prompt);
        this.activeGenerationModel = modelName;
        return response.response.text();
      } catch (error) {
        if (!isModelFallbackError(error) || modelName === models[models.length - 1]) throw error;
      }
    }
  }

  getModelInfo() {
    const configuredModel = this.generationModels[0];
    const activeModel = this.activeGenerationModel || configuredModel;
    return {
      provider: 'gemini',
      configuredModel,
      name: activeModel,
      embeddingModel: this.activeEmbeddingModel || this.embeddingModels[0],
      fallbackUsed: Boolean(this.activeGenerationModel && activeModel !== configuredModel),
      fallbacksEnabled: this.generationModels.length > 1,
    };
  }
}

function isModelFallbackError(error) {
  const message = String(error?.message || error).toLowerCase();
  return /404|not found|not available|unsupported|deprecated|no longer available/.test(message);
}

module.exports = { GeminiProvider, isModelFallbackError };
