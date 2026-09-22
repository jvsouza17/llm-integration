const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');

const { parseDocumentText } = require('../src/services/documentParser');
const { splitIntoChunks } = require('../src/services/chunker');
const { cosineSimilarity, buildIndex, findRelevantChunks } = require('../src/services/vectorStore');
const { createApp } = require('../src/server');
const { GroqProvider } = require('../src/services/groqProvider');
const { GeminiProvider, isModelFallbackError } = require('../src/services/geminiProvider');
const { renderMarkdownToHtml } = require('../src/services/markdownRenderer');

const sampleMd = `# Residencial Alameda das Águas\n\n## Tipologia\n- 2 quartos: 58 m²\n- 3 quartos: 72 m²\n\n## Lazer\n- Piscina\n- Espaço pet\n`;

test('parseDocumentText extrai texto de markdown', async () => {
  const tempFile = path.join(os.tmpdir(), `document-${Date.now()}.md`);
  fs.writeFileSync(tempFile, sampleMd, 'utf8');
  const text = await parseDocumentText(tempFile);
  assert.match(text, /Residencial Alameda das Águas/);
  assert.match(text, /3 quartos/);
  fs.unlinkSync(tempFile);
});

test('splitIntoChunks separa por bloco e preserva sobreposição', () => {
  const text = 'A '.repeat(1200);
  const chunks = splitIntoChunks(text, 200, 30);
  assert.ok(chunks.length >= 2);
  assert.ok(chunks[0].length <= 220);
  assert.ok(chunks[0].includes('A'));
});

test('splitIntoChunks preserva uma tabela Markdown inteira quando ela cabe', () => {
  const table = '| Tipo | Área |\n| --- | --- |\n| 3 quartos | 72 m² |';
  const chunks = splitIntoChunks(`# Tipologias\n\n${table}`, 200, 20);
  assert.equal(chunks.length, 1);
  assert.match(chunks[0], /\| Tipo \| Área \|[\s\S]*\| 3 quartos \| 72 m² \|/);
});

test('cosineSimilarity calcula similaridade corretamente', () => {
  const result = cosineSimilarity([1, 2, 3], [1, 0, 0]);
  assert.ok(Math.abs(result - 0.2672612419124244) < 1e-9);
});

test('findRelevantChunks recupera chunks relevantes', () => {
  const index = [
    { chunkId: 'c1', sourceFile: 'a.md', text: 'Apartamento', embedding: [1, 0, 0] },
    { chunkId: 'c2', sourceFile: 'b.md', text: 'Piscina', embedding: [0, 1, 0] },
    { chunkId: 'c3', sourceFile: 'c.md', text: 'Portaria', embedding: [0, 0, 1] },
  ];
  const result = findRelevantChunks(index, [1, 0, 0], 2);
  assert.equal(result[0].chunkId, 'c1');
  assert.equal(result.length, 2);
});

test('buildIndex organiza entradas e aguarda o provider assíncrono', async () => {
  const built = await buildIndex([
    { fileId: 'doc-1', originalName: 'Aguas.md', text: 'Apartamento de 3 quartos com 75 metros' },
    { fileId: 'doc-2', originalName: 'Guara.md', text: 'Piscina, academia e coworking' },
  ], { embed: async (value) => value.includes('3 quartos') ? [1, 0] : [0, 1] });
  assert.equal(built.length, 2);
  assert.equal(built[0].sourceFile, 'Aguas.md');
  assert.equal(built[0].metadata.fileId, 'doc-1');
});

test('GroqProvider mantém embeddings desacoplados e delegados ao provider configurado', async () => {
  const embeddingProvider = { embed: async () => [0.5, 0.5] };
  const provider = new GroqProvider({ apiKey: 'test-key', embeddingProvider });
  assert.deepEqual(await provider.embed('pergunta'), [0.5, 0.5]);
});

test('GeminiProvider usa fallback quando o modelo principal fica indisponível', async () => {
  const attempts = [];
  const client = {
    getGenerativeModel({ model }) {
      attempts.push(model);
      return {
        async generateContent() {
          if (model === 'modelo-indisponivel') {
            throw new Error('404 Not Found: model is no longer available');
          }
          return { response: { text: () => 'resposta do fallback' } };
        },
      };
    },
  };
  const provider = new GeminiProvider('test-key', {
    client,
    generationModels: ['modelo-indisponivel', 'modelo-gratuito'],
  });

  assert.equal(await provider.generate('pergunta'), 'resposta do fallback');
  assert.deepEqual(attempts, ['modelo-indisponivel', 'modelo-gratuito']);
  assert.equal(isModelFallbackError(new Error('404 Not Found')), true);
});

test('GeminiProvider expõe o modelo configurado e o modelo ativo', () => {
  const provider = new GeminiProvider('test-key', {
    client: { getGenerativeModel: () => ({}) },
    generationModels: ['modelo-principal', 'modelo-fallback'],
    embeddingModels: ['modelo-embedding'],
  });
  assert.deepEqual(provider.getModelInfo(), {
    provider: 'gemini',
    configuredModel: 'modelo-principal',
    name: 'modelo-principal',
    embeddingModel: 'modelo-embedding',
    fallbackUsed: false,
    fallbacksEnabled: true,
  });
});

test('renderMarkdownToHtml converte Markdown e remove HTML perigoso', () => {
  const html = renderMarkdownToHtml('## Título\n\n**Resposta**\n\n[fonte](https://example.com)');
  const unsafeHtml = renderMarkdownToHtml('<script>alert(1)</script>');
  assert.match(html, /<h2>Título<\/h2>/);
  assert.match(html, /<strong>Resposta<\/strong>/);
  assert.match(html, /<a href="https:\/\/example\.com">fonte<\/a>/);
  assert.doesNotMatch(unsafeHtml, /<script|alert\(1\)/);
});

test('API indexa upload e responde com a fonte usando provider injetado', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-api-'));
  const provider = {
    async embed(text) { return /3 quartos|pergunta/i.test(text) ? [1, 0] : [0, 1]; },
    async generate(prompt) { return `Resposta baseada em: ${prompt.match(/Fonte: ([^\n]+)/)?.[1] || 'documento'}`; },
    getModelInfo() {
      return {
        provider: 'gemini',
        configuredModel: 'modelo-principal',
        name: 'modelo-principal',
        embeddingModel: 'modelo-embedding',
        fallbackUsed: false,
        fallbacksEnabled: true,
      };
    },
  };
  const server = http.createServer(createApp({ provider, dataDir: tempDir }));
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const statusResponse = await fetch(`${baseUrl}/api/status`);
  const statusResult = await statusResponse.json();
  assert.equal(statusResponse.status, 200);
  assert.equal(statusResult.name, 'modelo-principal');

  const form = new FormData();
  form.append('file', new Blob(['# Alameda\n\n3 quartos com 72 m²'], { type: 'text/markdown' }), 'aguas.md');

  const uploadResponse = await fetch(`${baseUrl}/api/upload`, { method: 'POST', body: form });
  const uploadResult = await uploadResponse.json();
  assert.equal(uploadResponse.status, 200);
  assert.equal(uploadResult.sourceFile, 'aguas.md');
  assert.equal(uploadResult.chunksCount, 1);

  const chatResponse = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question: 'Qual apartamento tem 3 quartos?' }),
  });
  const chatResult = await chatResponse.json();
  assert.equal(chatResponse.status, 200);
  assert.match(chatResult.answer, /aguas\.md/);
  assert.equal(chatResult.sources[0].sourceFile, 'aguas.md');
  assert.equal(chatResult.model.name, 'modelo-principal');
});

test('API retorna erro seguro e permite retry quando a geração falha', async (t) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'rag-error-'));
  fs.writeFileSync(path.join(tempDir, 'index.json'), JSON.stringify([
    { chunkId: 'c1', sourceFile: 'a.md', text: 'conteúdo', embedding: [1, 0] },
  ]));
  const provider = {
    async embed() { return [1, 0]; },
    async generate() { throw new Error('falha interna com chave secreta'); },
    getModelInfo() { return { provider: 'gemini', name: 'modelo', configuredModel: 'modelo', embeddingModel: 'embed', fallbackUsed: false, fallbacksEnabled: true }; },
  };
  const server = http.createServer(createApp({ provider, dataDir: tempDir }));
  await new Promise((resolve) => server.listen(0, resolve));
  t.after(() => server.close());

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question: 'pergunta' }),
  });
  const result = await response.json();
  assert.equal(response.status, 500);
  assert.equal(result.retryable, true);
  assert.equal(result.error, 'Não foi possível gerar uma resposta agora.');
  assert.doesNotMatch(JSON.stringify(result), /chave secreta/);
});
