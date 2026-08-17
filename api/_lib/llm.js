/**
 * ── LLM Gateway ─────────────────────────────────────────────────
 * Processa mensagens usando OpenCode Zen (ou OpenRouter como fallback).
 * Usa o prompt gerado em prompt.js (dinâmico, por cidade) para guiar
 * o comportamento da IA.
 *
 * Retorna a resposta CRUA da IA (com marcadores [[TOOL:params]]).
 * O webhook é responsável por interpretar os marcadores e limpar o texto.
 */

const { buildPrompt } = require('./prompt');
const { saveSession } = require('./db');
const { mensagemSemChaveIA } = require('./mensagens');

// ── Provedores disponíveis ────────────────────────────────────
const PROVIDERS = [];

if (process.env.OPENCODE_ZEN_API_KEY) {
  PROVIDERS.push({
    name: 'opencode-zen',
    apiKey: process.env.OPENCODE_ZEN_API_KEY,
    url: 'https://opencode.ai/zen/v1/chat/completions',
    model: 'deepseek-v4-flash-free',
  });
}

if (process.env.OPENROUTER_API_KEY) {
  PROVIDERS.push({
    name: 'openrouter',
    apiKey: process.env.OPENROUTER_API_KEY,
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
  });
}

/**
 * Remove os marcadores de ferramenta do texto da IA.
 * Ex: "[[RECOMENDAR:centro:cultura]] Que tal..." → "Que tal..."
 */
function cleanToolMarkers(text) {
  return text
    .replace(/\[\[PERFIL:[^\]]+\]\]\s*/g, '')
    .replace(/\[\[HORARIO:[^\]]+\]\]\s*/g, '')
    .trim();
}

/**
 * Chama um provedor LLM.
 * @returns {string|null} — null se o conteúdo veio vazio (sinaliza fallback)
 */
async function callProvider(provider, messages) {
  const body = {
    model: provider.model,
    messages,
    max_tokens: 1024,
    temperature: 0.7,
  };

  const res = await fetch(provider.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 429) {
      throw new Error(`RATE_LIMIT: ${err}`);
    }
    throw new Error(`${res.status}: ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;

  // Se veio vazio (DeepSeek às vezes retorna reasoning_content vazio),
  // tenta uma vez com retry
  if (!content || content.trim() === '') {
    const retryRes = await fetch(provider.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (retryRes.ok) {
      const retryData = await retryRes.json();
      const retryContent = retryData.choices?.[0]?.message?.content;
      if (retryContent && retryContent.trim() !== '') {
        return retryContent;
      }
    }
    return null; // sinaliza para tentar próximo provider
  }

  return content;
}

/**
 * Processa a mensagem do usuário com fallback entre provedores.
 * Retorna a resposta CRUA (com marcadores [[TOOL:params]] inclusos).
 *
 * @param {string} userMessage
 * @param {object} session
 * @returns {Promise<string>}
 */
async function processWithLLM(userMessage, session) {
  if (PROVIDERS.length === 0) {
    return mensagemSemChaveIA();
  }

  const systemPrompt = buildPrompt(session);

  const messages = [
    ...session.history.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    })),
    { role: 'user', content: userMessage },
  ];

  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    for (const provider of PROVIDERS) {
      try {
        const reply = await callProvider(provider, [
          { role: 'system', content: systemPrompt },
          ...messages,
        ]);

        // Provider retornou null (conteúdo vazio) → tenta próximo
        if (reply === null) {
          continue;
        }

        // Salva no histórico (versão limpa, sem marcadores)
        const displayText = cleanToolMarkers(reply);
        session.history.push({ role: 'user', content: userMessage });
        session.history.push({ role: 'assistant', content: displayText });
        // Mantém apenas as últimas 12 mensagens (6 turnos)
        if (session.history.length > 12) {
          session.history = session.history.slice(-12);
        }

        // Persiste a memória do usuário no banco
        await saveSession(session.chatId, session);

        // Retorna a resposta CRUA (com marcadores) para o webhook processar
        return reply;
      } catch (err) {
        console.error(`[${provider.name}]`, err.message);
        lastError = err;

        if (err.message.includes('RATE_LIMIT') && attempt === 0) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }
  }

  return '❌ Desculpe, não consegui processar sua mensagem agora. Tente novamente em alguns instantes.';
}

module.exports = { processWithLLM, cleanToolMarkers };