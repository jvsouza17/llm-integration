# Spec: Chat com Base de Conhecimento (RAG)

## 0. Contexto do projeto (domínio)
Domínio: **conteúdo imobiliário**. Os documentos indexados são cadernos técnicos (fictícios, para teste) de empreendimentos residenciais na região de Águas Claras, DF, cobrindo localização, tipologias de apartamento, áreas de lazer, especificações técnicas e dados de incorporação.

Documento de exemplo já disponível para popular a base: `base-conhecimento-aguas-claras.md` (Residencial Alameda das Águas). O agente deve indexar esse arquivo `.md` como primeiro documento de teste do fluxo de upload/chat.

Implicação prática: como o domínio é relativamente estruturado (tabelas de área, listas de itens de lazer, dados técnicos), o `chunker.js` deve preservar blocos como tabelas Markdown inteiras dentro de um mesmo chunk sempre que possível, em vez de cortar no meio de uma tabela — isso evita perder o contexto de linha/coluna ao responder perguntas sobre metragens ou vagas.

## 1. Objetivo
Construir uma aplicação simples de chat que responde perguntas com base em um conjunto de documentos fornecidos pelo usuário (RAG — Retrieval-Augmented Generation). Front-end em HTML puro (sem framework). Back-end em Node.js.

## 2. Escopo funcional
- Upload de documentos (`.txt`, `.md`, `.pdf`) via endpoint HTTP.
- Indexação: extrair texto, dividir em chunks, gerar embeddings e guardar em memória (ou arquivo local JSON — sem banco vetorial externo nesta v1).
- Chat: usuário envia pergunta, back-end busca os chunks mais relevantes (similaridade de cosseno) e monta um prompt com esse contexto para a LLM.
- Resposta deve citar de qual documento/trecho veio a informação, quando possível.
- Interface HTML simples: caixa de upload, lista de documentos indexados, janela de chat.

Fora de escopo na v1: autenticação, múltiplos usuários, banco vetorial dedicado (Pinecone/Weaviate), persistência em banco de dados relacional.

## 3. Decisão de IA: Gemini

O projeto usa Gemini como provedor único para geração de texto e embeddings, mantendo a integração simples e adequada ao protótipo.

O provider deve manter uma interface com os métodos `embed(text)` e `generate(prompt)`, permitindo futuras alterações sem acoplar o restante do RAG ao SDK do provedor.

O agente deve implementar o cliente de LLM como uma interface (`LLMProvider`) com dois métodos: `embed(text)` e `generate(prompt)`, para permitir troca de provedor sem reescrever o resto do sistema.

## 4. Stack técnica
- **Back-end**: Node.js + Express
- **Front-end**: HTML + CSS + JS puro (sem build step, sem framework)
- **LLM**: Google Gemini API (`@google/generative-ai` ou chamadas REST diretas)
- **Parsing de PDF**: `pdf-parse`
- **Armazenamento de índice**: arquivo JSON local (`data/index.json`) contendo `{ chunkId, text, embedding, sourceFile }`

## 5. Arquitetura (fluxo)
```text
[Upload documento] → extrai texto → divide em chunks (~500 tokens, overlap ~50)
  → gera embedding de cada chunk (Gemini) → salva em data/index.json

[Pergunta do usuário] → gera embedding da pergunta (Gemini)
  → calcula similaridade de cosseno contra todos os chunks salvos
  → seleciona top-K (ex: 4) chunks mais relevantes
  → monta prompt: system + contexto (chunks) + pergunta
  → chama Gemini generate() → retorna resposta + fontes usadas
```

## 6. Estrutura de pastas sugerida
```text
/src
  /server.js            # bootstrap Express
  /routes
    upload.js            # POST /api/upload
    chat.js              # POST /api/chat
  /services
    llmProvider.js        # interface LLMProvider (embed/generate)
    geminiProvider.js    # implementação Gemini com fallback de modelos
    documentParser.js    # extrai texto de txt/md/pdf
    chunker.js           # divide texto em chunks
    vectorStore.js       # salva/lê index.json, calcula similaridade
/public
  index.html
  style.css
  app.js
/data
  index.json             # criado em runtime
.env.example
package.json
```

## 7. Endpoints da API
- `POST /api/upload` — recebe arquivo (multipart), processa, indexa. Retorna `{ fileId, chunksCount }`.
- `GET /api/documents` — lista documentos indexados.
- `POST /api/chat` — body `{ question: string }`. Retorna `{ answer: string, sources: [{ sourceFile, snippet }] }`.

## 8. Variáveis de ambiente (`.env`)
```env
GEMINI_API_KEY=
GEMINI_EMBEDDING_MODEL=gemini-embedding-001
GEMINI_GENERATION_MODEL=gemini-3.6-flash # fallback automático para modelos Flash
PORT=3000
```

## 9. Critérios de aceite
- [x] Consigo subir um `.txt`/`.md`/`.pdf` e ele aparece indexado.
- [x] Ao perguntar algo presente nos documentos, a resposta reflete o conteúdo real (sem alucinar).
- [x] A resposta indica de qual arquivo veio a informação pela API.
- [x] O provider Gemini permanece desacoplado do restante do código por meio da interface `LLMProvider`.
- [x] Interface HTML funcional: upload, lista de docs, chat e histórico da sessão em memória.

## 10. Passos de implementação sugeridos para o agente
1. [x] Criar `package.json` e instalar `express`, `dotenv`, `multer`, `pdf-parse`, `@google/generative-ai`, `marked` e `sanitize-html`.
2. [x] Implementar `documentParser.js` e `chunker.js`, preservando tabelas Markdown quando possível.
3. [x] Implementar `llmProvider.js`, `geminiProvider.js` e fallback automático de modelos.
4. [x] Implementar `vectorStore.js` com similaridade de cosseno e persistência em `data/index.json`.
5. [x] Implementar endpoints de upload, documentos, status e chat.
6. [x] Implementar o frontend HTML/JS com upload, documentos, chat, status do modelo e indicador de processamento.
7. [x] Testar o fluxo fim a fim com documento Markdown e provider injetado.
8. [x] Converter respostas Markdown para HTML sanitizado antes da exibição.
