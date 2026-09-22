const express = require('express');
const path = require('node:path');
const dotenv = require('dotenv');
const fs = require('node:fs');
const multer = require('multer');
const { parseDocumentText } = require('./services/documentParser');
const { splitIntoChunks } = require('./services/chunker');
const { buildIndex, findRelevantChunks } = require('./services/vectorStore');
const { createProvider } = require('./services/providerFactory');
const { renderMarkdownToHtml } = require('./services/markdownRenderer');

dotenv.config();

function createApp(options = {}) {
  const app = express();
  const dataDir = options.dataDir || path.join(__dirname, '..', 'data');
  const indexFile = options.indexFile || path.join(dataDir, 'index.json');
  const uploadDir = options.uploadDir || path.join(dataDir, 'uploads');
  const provider = options.provider || createProvider();
  const getModelInfo = () => typeof provider.getModelInfo === 'function'
    ? provider.getModelInfo()
    : {
      provider: 'unknown',
      configuredModel: 'unknown',
      name: 'unknown',
      embeddingModel: 'unknown',
      fallbackUsed: false,
      fallbacksEnabled: false,
    };

  fs.mkdirSync(uploadDir, { recursive: true });
  const upload = multer({
    dest: uploadDir,
    fileFilter: (req, file, callback) => {
      callback(null, ['.txt', '.md', '.pdf'].includes(path.extname(file.originalname).toLowerCase()));
    },
  });

  function readIndex() {
    if (!fs.existsSync(indexFile)) return [];
    return JSON.parse(fs.readFileSync(indexFile, 'utf8') || '[]');
  }

  function writeIndex(entries) {
    fs.mkdirSync(path.dirname(indexFile), { recursive: true });
    fs.writeFileSync(indexFile, JSON.stringify(entries, null, 2), 'utf8');
  }

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/status', (req, res) => {
    res.json(getModelInfo());
  });

  app.get('/api/documents', (req, res) => {
    const entries = readIndex();
    const sourceFiles = [...new Set(entries.map((entry) => entry.sourceFile))];
    res.json({
      documents: sourceFiles.map((sourceFile) => ({
        sourceFile,
        chunkCount: entries.filter((entry) => entry.sourceFile === sourceFile).length,
      })),
    });
  });

  app.post('/api/upload', upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo obrigatório. Formatos aceitos: .txt, .md e .pdf.' });
    }

    try {
      const text = await parseDocumentText(req.file.path, req.file.originalname);
      const chunks = splitIntoChunks(text, 500, 50);
      if (!chunks.length) return res.status(400).json({ error: 'O arquivo não contém texto indexável.' });

      const documents = chunks.map((chunkText, chunkIndex) => ({
        fileId: req.file.filename,
        originalName: req.file.originalname,
        text: chunkText,
        chunkIndex,
      }));
      const entries = await buildIndex(documents, provider);
      writeIndex([...readIndex(), ...entries]);

      return res.json({ fileId: req.file.filename, chunksCount: entries.length, sourceFile: req.file.originalname });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: error.message || 'Erro ao processar upload.' });
    } finally {
      fs.promises.unlink(req.file.path).catch(() => {});
    }
  });

  app.post('/api/chat', async (req, res) => {
    try {
      const question = String(req.body?.question || '').trim();
      if (!question) return res.status(400).json({ error: 'Pergunta obrigatória.' });

      const index = readIndex();
      if (!index.length) {
        return res.json({ answer: 'Ainda não há documentos indexados. Faça upload de um arquivo antes de perguntar.', sources: [] });
      }

      const queryEmbedding = await provider.embed(question);
      const relevant = findRelevantChunks(index, queryEmbedding, 4);
      const context = relevant.map((entry) => `Fonte: ${entry.sourceFile}\n${entry.text}`).join('\n\n---\n\n');
      const prompt = [
        'Use apenas as informações abaixo para responder.',
        'Se não houver informação suficiente, diga que não encontrou no material fornecido.',
        '', context, '', `Pergunta: ${question}`,
      ].join('\n');
      const answer = await provider.generate(prompt);

      return res.json({
        answer: renderMarkdownToHtml(answer),
        sources: relevant.map((entry) => ({ sourceFile: entry.sourceFile, snippet: entry.text.slice(0, 200) })),
        model: getModelInfo(),
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: 'Não foi possível gerar uma resposta agora.', retryable: true });
    }
  });

  app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));
  return app;
}

if (require.main === module) {
  const port = process.env.PORT || 3000;
  createApp().listen(port, () => console.log(`Servidor rodando em http://localhost:${port}`));
}

module.exports = { createApp };
