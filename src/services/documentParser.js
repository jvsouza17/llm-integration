const fs = require('node:fs/promises');
const path = require('node:path');

async function parseDocumentText(filePath, originalName = filePath) {
  const ext = path.extname(originalName).toLowerCase();
  const content = await fs.readFile(filePath, 'utf8');

  if (ext === '.md' || ext === '.txt') {
    return content;
  }

  if (ext === '.pdf') {
    const { PDFParse } = require('pdf-parse');
    const parser = new PDFParse({ data: await fs.readFile(filePath) });
    try {
      const result = await parser.getText();
      return result.text || '';
    } finally {
      await parser.destroy();
    }
  }

  throw new Error(`Formato de arquivo não suportado: ${ext}`);
}

module.exports = {
  parseDocumentText,
};
