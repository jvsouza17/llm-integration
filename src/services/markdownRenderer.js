const { marked } = require('marked');
const sanitizeHtml = require('sanitize-html');

marked.setOptions({
  breaks: true,
  gfm: true,
  headerIds: false,
  mangle: false,
});

function renderMarkdownToHtml(markdown) {
  const rendered = marked.parse(String(markdown || ''));
  return sanitizeHtml(rendered, {
    allowedTags: [
      'p', 'br', 'strong', 'em', 'del', 'blockquote', 'code', 'pre',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {
      a: ['http', 'https', 'mailto'],
    },
  });
}

module.exports = { renderMarkdownToHtml };
