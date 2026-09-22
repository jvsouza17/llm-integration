# PRD: Chat com Base de Conhecimento (RAG)

## 0. Contexto do projeto (domínio escolhido)
Domínio: **conteúdo imobiliário**. A base de conhecimento reúne cadernos técnicos (fictícios, para fins de teste/demonstração) de empreendimentos residenciais na região de Águas Claras, DF — cada um descrevendo localização, tipologias de apartamento, áreas de lazer, especificações técnicas e informações de incorporação.

Exemplo de documento já produzido para popular a base: `base-conhecimento-aguas-claras.md` (Residencial Alameda das Águas, empreendimento 100% fictício, criado a partir da estrutura de um caderno técnico real usado como referência de formato).

Esse domínio substitui o exemplo genérico usado nas versões anteriores deste PRD e orienta os casos de uso, critérios de sucesso e riscos abaixo.

## 1. Problema
Encontrar informação específica dentro de um conjunto de documentos (anotações, manuais, PDFs, materiais de projeto) exige leitura manual e busca por palavra-chave, que falha quando a pergunta não usa os mesmos termos do documento. Falta uma forma de perguntar em linguagem natural e obter respostas ancoradas nesses documentos.

## 2. Objetivo
Oferecer um chat simples onde o usuário sobe documentos e faz perguntas sobre o conteúdo deles, recebendo respostas geradas por IA com base apenas no material fornecido (não em conhecimento genérico do modelo), com indicação da fonte.

## 3. Usuário-alvo
João, desenvolvedor/consultor com atuação em marketing imobiliário, para uso pessoal e como demonstração/protótipo: consultar rapidamente informações de cadernos técnicos de empreendimentos sem precisar reabrir cada PDF manualmente.

## 4. Casos de uso
- Subir cadernos técnicos de vários empreendimentos (ex: Residencial Alameda das Águas) e perguntar "quais têm apartamento de 3 quartos com mais de 70 m²?"
- Perguntar sobre itens de lazer específicos: "qual empreendimento tem espaço pet?"
- Comparar informações técnicas entre empreendimentos: metragens, número de vagas, prazo de entrega, diferenciais de sustentabilidade.
- Consultar detalhes de localização e diferenciais de bairro sem precisar vasculhar o PDF completo.

## 5. Fora de escopo (v1)
- Múltiplos usuários / autenticação.
- Persistência em banco de dados robusto (fica em arquivo local por enquanto).
- Edição colaborativa ou histórico de conversas entre sessões.
- Interface mobile dedicada.

## 6. Critérios de sucesso
- Usuário consegue subir um documento e obter uma resposta correta sobre o conteúdo em menos de 1 minuto do upload.
- Respostas citam a fonte (arquivo/trecho) usada.
- Sistema evita "alucinar": quando a informação não está nos documentos, ele diz que não encontrou, em vez de inventar.

## 7. Prioridades
1. Upload e indexação de documentos funcionando de ponta a ponta.
2. Chat retornando respostas ancoradas no conteúdo, com fonte.
3. Interface usável (mesmo que simples).
4. Flexibilidade de trocar provedor de LLM sem reescrever o sistema (ver spec técnica).

## 8. Riscos / pontos de atenção
- Qualidade da resposta depende diretamente da qualidade do "chunking" dos documentos — chunks mal divididos geram contexto ruim.
- Sem banco vetorial dedicado, a busca por similaridade em memória pode ficar lenta com muitos documentos (aceitável na v1, mas é o primeiro gargalo esperado se o volume crescer).
- Depende de free tier de API externa (Gemini): possível limite de uso a monitorar.

## 9. Relação com a spec técnica
<<<<<<< HEAD
Este PRD define o *porquê* e o *o quê* do produto. A implementação técnica (stack, arquitetura, endpoints, decisão Gemini vs Groq) está detalhada em `spec-chat-rag.md`, que traduz estes requisitos em instruções de construção para o agente de código.
=======
Este PRD define o *porquê* e o *o quê* do produto. A implementação técnica (stack, arquitetura, endpoints, decisão Gemini vs Groq) está detalhada em `spec-chat-rag.md`, que traduz estes requisitos em instruções de construção para o agente de código.
>>>>>>> afcccf7810420cd899bfdfadd70b49edfd4816bc
