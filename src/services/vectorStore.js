function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) {
    throw new Error('Vetores inválidos para similaridade de cosseno');
  }

  const dot = a.reduce((sum, value, index) => sum + value * b[index], 0);
  const normA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0));
  const normB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0));

  if (normA === 0 || normB === 0) return 0;
  return dot / (normA * normB);
}

async function buildIndex(documents, llmProvider) {
  const entries = [];

  for (const document of documents) {
    const chunkText = String(document.text || '').trim();
    if (!chunkText) continue;

    const embedding = llmProvider && typeof llmProvider.embed === 'function'
      ? await llmProvider.embed(chunkText)
      : [1];

    entries.push({
      chunkId: `${document.fileId || 'doc'}-${document.chunkIndex || entries.length}`,
      text: chunkText,
      embedding,
      sourceFile: document.originalName || document.fileName || 'unknown.md',
      metadata: {
        fileId: document.fileId || null,
        originalName: document.originalName || null,
        chunkIndex: document.chunkIndex ?? null,
      },
    });
  }

  return entries;
}

function findRelevantChunks(index, queryEmbedding, topK = 4) {
  return index
    .map((entry) => ({
      ...entry,
      score: cosineSimilarity(entry.embedding, queryEmbedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

module.exports = {
  cosineSimilarity,
  buildIndex,
  findRelevantChunks,
};
