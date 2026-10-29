# Spec 2: Identificação do modelo e estado de resposta

## 0. Objetivo

Evoluir a interface do chat para que o usuário saiba:

1. qual modelo de IA está sendo usado na conversa;
2. quando a pergunta está sendo processada;
3. quando a resposta está sendo gerada;
4. quando houve fallback para outro modelo;
5. quando ocorreu um erro, sem deixar a tela em estado indefinido;
6. que a resposta foi formatada em HTML seguro, e não exibida como Markdown cru;
7. que a resposta tenha uma estrutura visual clara, sem asteriscos ou marcadores Markdown visíveis;
8. que as fontes não sejam exibidas abaixo da resposta na conversa.

Esta spec é incremental e preserva o fluxo de upload, indexação, busca e fontes definido em `SPEC1.md`.

## 1. Escopo

### Incluído

- Exibição do provedor e do modelo de geração ativo.
- Exibição opcional do modelo de embeddings ativo.
- Indicador animado enquanto a IA processa a mensagem.
- Estado visual de erro com possibilidade de tentar novamente.
- Informação sobre fallback quando o modelo principal não estiver disponível.
- Bloqueio temporário do envio duplicado durante uma requisição.
- Conversão das respostas Markdown da IA para HTML sanitizado antes da exibição.
- Formatação visual organizada da resposta, com hierarquia de títulos, parágrafos e listas.
- Ocultação das fontes no bloco visual da resposta.

### Fora de escopo

- Streaming de tokens em tempo real.
- Histórico persistente de conversas.
- Alteração manual do modelo pela interface.
- Configuração de chaves de API no frontend.
- Criação de uma nova conta ou autenticação de usuários.

## 2. Experiência esperada

### 2.1 Modelo atual

A tela deve exibir uma identificação discreta e sempre visível no cabeçalho do chat, por exemplo:

```text
Gemini · gemini-3.6-flash
```

Se o backend ainda não tiver confirmado o modelo, a interface deve mostrar:

```text
Modelo configurado: Gemini
```

A interface não deve exibir a chave de API.

### 2.2 Envio da pergunta

Ao enviar uma pergunta:

- a mensagem do usuário aparece imediatamente;
- o campo de pergunta é limpo;
- o botão de envio fica desabilitado;
- um balão temporário da IA aparece no chat;
- o balão mostra três pontos animados e o texto `Pensando...`;
- o indicador permanece até a resposta ou erro;
- não deve haver mais de um indicador ativo para a mesma requisição.

Exemplo visual:

```text
IA
Pensando... ...
```

O texto pode alternar entre `Pensando...` e `Gerando resposta...`, mas não deve sugerir que tokens estão sendo recebidos se o backend não usa streaming.

### 2.3 Resposta concluída

Quando a API responder:

- o indicador é removido;
- a resposta da IA é exibida como HTML formatado, com suporte a títulos, parágrafos, listas, ênfase, links e tabelas;
- a resposta não exibe asteriscos, delimitadores Markdown ou outros marcadores de formatação crus;
- as fontes não são exibidas abaixo da resposta na conversa;
- o modelo efetivamente utilizado pode ser exibido junto à resposta;
- o botão de envio é reabilitado;
- o foco retorna ao campo de pergunta.

### 2.4 Fallback

Se o modelo principal falhar e outro modelo responder:

- a resposta deve ser exibida normalmente;
- o backend deve retornar o modelo efetivamente usado;
- a interface deve exibir uma indicação discreta, por exemplo:

```text
Respondido por Gemini · gemini-2.5-flash-lite
Modelo alternativo utilizado
```

Não exibir detalhes técnicos extensos do erro para o usuário final.

### 2.5 Erro

Se todos os modelos falharem:

- o indicador é removido;
- o botão de envio é reabilitado;
- a interface exibe uma mensagem de erro no balão da IA;
- a pergunta do usuário não deve desaparecer;
- deve existir uma ação `Tentar novamente`;
- o erro completo permanece registrado no console do backend, sem expor a chave da API.

### 2.6 Formatação da resposta

O modelo pode continuar gerando texto em Markdown, mas o backend deve convertê-lo para HTML antes de retornar a resposta ao frontend.

A apresentação deve priorizar leitura rápida:

- usar títulos e subtítulos HTML quando houver seções;
- usar parágrafos separados para ideias diferentes;
- usar listas HTML para conjuntos de itens;
- usar tabelas HTML apenas quando a comparação tabular for realmente útil;
- evitar blocos longos sem divisão visual;
- remover asteriscos de ênfase, listas e separadores que tenham permanecido no texto;
- nunca exibir Markdown cru como texto da resposta.

Exemplo de entrada do modelo:

```markdown
## Tipologias

- 2 quartos: 58 m²
- 3 quartos: 72 m²
```

Valor esperado no campo `answer`:

```html
<h2>Tipologias</h2>
<ul>
<li>2 quartos: 58 m²</li>
<li>3 quartos: 72 m²</li>
</ul>
```

O HTML precisa ser sanitizado. Tags executáveis, atributos perigosos e protocolos de URL não permitidos devem ser removidos antes de chegar ao navegador.

As fontes podem continuar sendo retornadas no contrato interno da API para auditoria e evolução futura, mas não devem ser renderizadas abaixo da resposta na interface desta versão.

## 3. Contrato da API

### 3.1 `GET /api/status`

Novo endpoint para carregar a identificação inicial do modelo:

```json
{
  "provider": "gemini",
  "configuredModel": "gemini-3.6-flash",
  "embeddingModel": "gemini-embedding-001",
  "fallbacksEnabled": true
}
```

O campo `configuredModel` representa o modelo configurado ou o primeiro modelo da cadeia. O modelo efetivamente utilizado em uma resposta deve ser informado no endpoint de chat.

### 3.2 `POST /api/chat`

A resposta de sucesso deve manter o contrato atual e adicionar metadados:

```json
{
  "answer": "<h2>Tipologias</h2><ul><li>3 quartos: 72 m²</li></ul>",
  "sources": [
    {
      "sourceFile": "base-conhecimento-aguas-claras.md",
      "snippet": "..."
    }
  ],
  "model": {
    "provider": "gemini",
    "name": "gemini-3.6-flash",
    "fallbackUsed": false
  }
}
```

Quando houver fallback:

```json
{
  "model": {
    "provider": "gemini",
    "name": "gemini-2.5-flash-lite",
    "fallbackUsed": true
  }
}
```

Em caso de erro:

```json
{
  "error": "Não foi possível gerar uma resposta agora.",
  "retryable": true
}
```

O backend não deve retornar stack trace, chave de API ou URL contendo credenciais.

## 4. Estado do frontend

O frontend deve controlar explicitamente os estados:

```text
idle → submitting → waiting → success
                         └→ error
```

### Estado `idle`

- campo habilitado;
- botão habilitado;
- nenhum indicador de processamento.

### Estado `submitting` / `waiting`

- pergunta já exibida;
- indicador da IA visível;
- campo e botão desabilitados;
- requisição em andamento.

### Estado `success`

- resposta exibida;
- fontes e modelo visíveis;
- controles habilitados.

### Estado `error`

- mensagem de erro exibida;
- pergunta preservada no histórico;
- ação de retry disponível;
- controles habilitados.

## 5. Alterações técnicas esperadas

### Backend

- Adicionar `getModelInfo()` à interface `LLMProvider` ou fornecer metadados equivalentes.
- Fazer `GeminiProvider` informar o modelo ativo após fallback.
- Adicionar `GET /api/status`.
- Adicionar o objeto `model` à resposta de `POST /api/chat`.
- Manter o fallback automático existente.
- Converter a saída Markdown do modelo para HTML com um renderer controlado.
- Sanitizar o HTML antes de incluí-lo no campo `answer`.

### Frontend

- Adicionar um elemento de status do modelo no cabeçalho do chat.
- Criar um elemento temporário para o indicador `Pensando...`.
- Remover o indicador em sucesso e erro usando o mesmo identificador da requisição.
- Desabilitar e reabilitar os controles de chat corretamente.
- Renderizar o modelo sem usar HTML vindo diretamente da LLM.
- Não renderizar a lista de fontes abaixo da resposta.
- Implementar `Tentar novamente` reutilizando a pergunta original.
- Renderizar `answer` como HTML sanitizado, mantendo fontes e metadados fora do conteúdo gerado.

### Acessibilidade

- O indicador deve usar `aria-live="polite"`.
- O estado de carregamento deve ter `role="status"`.
- O botão desabilitado deve continuar legível.
- A animação deve respeitar `prefers-reduced-motion`.
- O nome do modelo deve estar disponível como texto, não apenas como tooltip.

## 6. Critérios de aceite

- [x] Ao abrir a aplicação, o usuário vê o provedor e o modelo configurado.
- [x] Ao enviar uma pergunta, aparece imediatamente um indicador `Pensando...`.
- [x] O indicador desaparece quando a resposta chega.
- [x] O indicador também desaparece quando ocorre erro.
- [x] O usuário não consegue disparar duas requisições pela mesma ação enquanto a primeira está pendente.
- [x] A resposta informa o modelo efetivamente utilizado.
- [x] Quando houver fallback, a interface indica que um modelo alternativo foi utilizado.
- [x] O botão `Tentar novamente` refaz a pergunta sem duplicar o texto manualmente.
- [x] As fontes não são exibidas abaixo da resposta na conversa.
- [x] Nenhuma chave de API aparece na interface ou nas respostas HTTP.
- [x] A resposta da IA é retornada em HTML, não em Markdown cru.
- [ ] A resposta é organizada em parágrafos, títulos, listas ou tabelas conforme o conteúdo.
- [ ] Asteriscos e marcadores Markdown não aparecem como texto na resposta renderizada.
- [x] Tags executáveis, atributos perigosos e protocolos de URL não permitidos são removidos.
- [x] O layout continua funcional em desktop e telas estreitas.
- [x] A suíte automatizada cobre sucesso, fallback, erro, remoção do indicador e sanitização HTML.

## 7. Plano de implementação

1. Adicionar metadados de modelo aos providers.
2. Adicionar `GET /api/status`.
3. Estender a resposta do chat com `model`.
4. Atualizar o HTML com o status do modelo.
5. Implementar o estado visual `Pensando...` no frontend.
6. Implementar tratamento de erro e retry.
7. Converter Markdown para HTML sanitizado no backend.
8. Adicionar testes de API para status, sucesso, fallback, erro e HTML seguro.
9. Validar manualmente upload, pergunta, fallback, erro, organização visual e ausência de fontes abaixo da resposta.
