/**
 * ── LLM Gateway ─────────────────────────────────────────────────
 * Processa mensagens usando OpenCode Zen (ou OpenRouter como fallback).
 * Usa o prompt definido em prompt.js para guiar o comportamento da IA.
 */

const { PROMPT } = require('./prompt');

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

// ── Cache de sessões (em memória) ─────────────────────────────
// Vercel serverless: cada instância tem seu próprio cache.
// Para produção, usar Redis ou PostgreSQL.
const sessions = new Map();

/**
 * Recupera ou cria sessão para um chat.
 * @param {number|string} chatId
 * @returns {object}
 */
function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, {
      history: [],
      user: null,     // { nome, bairro, interesses }
      pontos: 0,
      missoes: [],
    });
  }
  return sessions.get(chatId);
}

/**
 * Chama um provedor LLM com as mensagens do histórico.
 */
async function callProvider(provider, messages) {
  const body = {
    model: provider.model,
    messages: [
      { role: 'system', content: PROMPT },
      ...messages,
    ],
    max_tokens: 512,
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

  if (!content || content.trim() === '') {
    // Retry uma vez
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
  }

  return content || '❌ Sem resposta da IA.';
}

/**
 * Processa a mensagem do usuário com fallback entre provedores.
 * @param {string} userMessage
 * @param {object} session
 * @returns {Promise<string>}
 */
async function processWithLLM(userMessage, session) {
  if (PROVIDERS.length === 0) {
    return (
      `Olá! 😊 Para eu funcionar, preciso de uma chave de IA configurada.\n\n` +
      `Peça ao desenvolvedor para definir OPENCODE_ZEN_API_KEY ou OPENROUTER_API_KEY.`
    );
  }

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
        const reply = await callProvider(provider, messages);

        // Limpa o formato de ferramenta da resposta (se veio junto com texto)
        const cleanReply = reply
          .replace(/\[\[RECOMENDAR:[^\]]+\]\]\s*/g, '')
          .replace(/\[\[MISSAO:[^\]]+\]\]\s*/g, '')
          .replace(/\[\[PONTOS:[^\]]+\]\]\s*/g, '')
          .replace(/\[\[CONFIRMAR:[^\]]+\]\]\s*/g, '')
          .trim() || reply;

        return cleanReply;
      } catch (err) {
        console.error(`[${provider.name}]`, err.message);
        lastError = err;

        if (err.message.includes('RATE_LIMIT') && attempt === 0) {
          // Espera 2s e tenta novamente
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    }
  }

  return '❌ Desculpe, não consegui processar sua mensagem agora. Tente novamente em alguns instantes.';
}

module.exports = { processWithLLM, getSession };
