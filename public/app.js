const uploadBtn = document.getElementById('uploadBtn');
const fileInput = document.getElementById('fileInput');
const uploadStatus = document.getElementById('uploadStatus');
const documentsList = document.getElementById('documentsList');
const chatForm = document.getElementById('chatForm');
const questionInput = document.getElementById('questionInput');
const chatMessages = document.getElementById('chatMessages');
const modelStatus = document.getElementById('modelStatus');
const submitQuestionBtn = document.getElementById('submitQuestionBtn');
let chatBusy = false;

async function loadDocuments() {
  const response = await fetch('/api/documents');
  const data = await response.json();

  documentsList.innerHTML = '';
  if (!data.documents || data.documents.length === 0) {
    documentsList.innerHTML = '<li>Nenhum documento indexado.</li>';
    return;
  }

  data.documents.forEach((doc) => {
    const li = document.createElement('li');
    li.textContent = `${doc.sourceFile} (${doc.chunkCount} chunks)`;
    documentsList.appendChild(li);
  });
}

uploadBtn.addEventListener('click', async () => {
  const file = fileInput.files[0];
  if (!file) {
    uploadStatus.textContent = 'Selecione um arquivo primeiro.';
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  uploadStatus.textContent = 'Enviando...';
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();
  uploadStatus.textContent = response.ok
    ? `Upload concluído: ${result.sourceFile} (${result.chunksCount} chunks)`
    : result.error || 'Erro no upload';

  if (response.ok) {
    loadDocuments();
  }
});

function modelLabel(model) {
  if (!model || model.name === 'unknown') return 'Modelo configurado: desconhecido';
  const provider = model.provider ? `${model.provider} · ` : '';
  return `${provider}${model.name}`;
}

function setChatBusy(isBusy) {
  chatBusy = isBusy;
  questionInput.disabled = isBusy;
  submitQuestionBtn.disabled = isBusy;
  submitQuestionBtn.textContent = isBusy ? 'Aguardando...' : 'Perguntar';
}

function addThinkingMessage() {
  const message = document.createElement('div');
  message.className = 'message bot thinking-message';
  message.dataset.role = 'thinking';
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  message.innerHTML = '<span>Pensando</span><span class="thinking-dots" aria-hidden="true"><i></i><i></i><i></i></span>';
  chatMessages.appendChild(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return message;
}

function addModelDetails(message, model) {
  if (!model || model.name === 'unknown') return;
  const details = document.createElement('small');
  details.className = 'model-details';
  details.textContent = `Respondido por ${model.provider} · ${model.name}${model.fallbackUsed ? ' · modelo alternativo' : ''}`;
  message.appendChild(document.createElement('br'));
  message.appendChild(details);
}

function addRetryAction(message, question) {
  const retryButton = document.createElement('button');
  retryButton.type = 'button';
  retryButton.className = 'retry-button';
  retryButton.textContent = 'Tentar novamente';
  retryButton.addEventListener('click', () => sendQuestion(question, false));
  message.appendChild(document.createElement('br'));
  message.appendChild(retryButton);
}

async function sendQuestion(question, showUserMessage = true) {
  if (chatBusy || !question) return;

  if (showUserMessage) {
    const userMessage = document.createElement('div');
    userMessage.className = 'message user';
    userMessage.textContent = question;
    chatMessages.appendChild(userMessage);
  }

  questionInput.value = '';
  setChatBusy(true);
  const thinkingMessage = addThinkingMessage();

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });
    const result = await response.json();
    thinkingMessage.remove();

    const botMessage = document.createElement('div');
    botMessage.className = `message bot${response.ok ? '' : ' error-message'}`;
    if (response.ok) {
      botMessage.innerHTML = result.answer || '<p>Sem resposta disponível.</p>';
    } else {
      botMessage.textContent = result.error || 'Não foi possível gerar uma resposta agora.';
    }
    if (response.ok) addModelDetails(botMessage, result.model);
    if (!response.ok && result.retryable) addRetryAction(botMessage, question);
    chatMessages.appendChild(botMessage);
    if (response.ok && result.model) modelStatus.textContent = modelLabel(result.model);
  } catch (error) {
    thinkingMessage.remove();
    const botMessage = document.createElement('div');
    botMessage.className = 'message bot error-message';
    botMessage.textContent = 'Não foi possível conectar ao servidor.';
    addRetryAction(botMessage, question);
    chatMessages.appendChild(botMessage);
  } finally {
    setChatBusy(false);
    questionInput.focus();
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
}

chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  sendQuestion(questionInput.value.trim());
});

async function loadModelStatus() {
  try {
    const response = await fetch('/api/status');
    if (response.ok) modelStatus.textContent = modelLabel(await response.json());
  } catch (error) {
    modelStatus.textContent = 'Modelo configurado: indisponível';
  }
}

loadDocuments();
loadModelStatus();
