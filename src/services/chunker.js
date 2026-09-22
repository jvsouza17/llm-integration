function splitIntoChunks(text, maxTokens = 500, overlap = 50) {
  if (!text || typeof text !== 'string') return [];

  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const chunkSize = Math.max(1, maxTokens);
  const overlapSize = Math.min(Math.max(0, overlap), chunkSize - 1);
  const blocks = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  const chunks = [];
  let current = '';

  for (const block of blocks) {
    if (block.length <= chunkSize) {
      if (current && current.length + 2 + block.length > chunkSize) {
        chunks.push(current);
        current = current.slice(-overlapSize);
      }
      current = current ? `${current}\n\n${block}` : block;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = current.slice(-overlapSize);
    }

    for (let start = 0; start < block.length; start += chunkSize - overlapSize) {
      const piece = block.slice(start, start + chunkSize).trim();
      if (piece) chunks.push(piece);
      if (start + chunkSize >= block.length) break;
    }
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

module.exports = {
  splitIntoChunks,
};
