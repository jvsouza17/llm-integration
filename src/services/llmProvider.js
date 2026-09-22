class LLMProvider {
  async embed() {
    throw new Error('embed() deve ser implementado pela classe concreta');
  }

  async generate() {
    throw new Error('generate() deve ser implementado pela classe concreta');
  }

  getModelInfo() {
    return {
      provider: 'unknown',
      configuredModel: 'unknown',
      embeddingModel: 'unknown',
      fallbacksEnabled: false,
    };
  }
}

module.exports = { LLMProvider };
