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

// O provedor OpenCode Zen gateia a capacidade gratuita dos modelos
// `-free` pelo header User-Agent: apenas requisições com
// `User-Agent: opencode/...` recebem 200; qualquer outro UA (ex.: o
// padrão do undici) recebe 429 FreeUsageLimitError.
const OPENCODE_USER_AGENT = 'opencode/1.18.16';

// Backoff padrão em HTTP 429 (quando não há header Retry-After).
const RETRY_BACKOFF_MS = 5000;

// Teto para o Retry-After: nunca espera mais que isso (não pendura a
// resposta do usuário).
const MAX_RETRY_AFTER_MS = 10000;

// Timeout do fetch de cada provedor LLM (como na Busca Web).
const LLM_TIMEOUT_MS = 10000;

// Janela de saúde da LLM: 429s recentes dentro desta janela marcam a
// LLM como não-saudável (sem "folga de rate-limit").
const JANELA_SAUDE_MS = 5 * 60 * 1000;

// Timestamps dos 429s mais recentes (para o tracker de saúde).
const falhasRecentes = [];

/**
 * Registra uma falha de rate-limit no tracker de saúde da LLM.
 * @param {number} [agora] — relógio injetável (default: Date.now)
 */
function registrarFalhaLLM(agora = Date.now()) {
  falhasRecentes.push(agora);
}

/**
 * True quando a LLM está saudável (sem 429 recente na janela).
 * Expurga falhas fora da janela a cada consulta.
 * @param {number} [agora] — relógio injetável (default: Date.now)
 */
function llmSaudavel(agora = Date.now()) {
  const limiar = agora - JANELA_SAUDE_MS;
  while (falhasRecentes.length && falhasRecentes[0] <= limiar) {
    falhasRecentes.shift();
  }
  return falhasRecentes.length === 0;
}

if (process.env.OPENCODE_ZEN_API_KEY) {
  PROVIDERS.push({
    name: 'opencode-zen',
    apiKey: process.env.OPENCODE_ZEN_API_KEY,
    url: 'https://opencode.ai/zen/v1/chat/completions',
    model: 'deepseek-v4-flash-free',
    userAgent: OPENCODE_USER_AGENT,
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

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${provider.apiKey}`,
  };
  if (provider.userAgent) {
    headers['User-Agent'] = provider.userAgent;
  }

  const res = await fetch(provider.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
  });

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 429) {
      const e = new Error(`RATE_LIMIT: ${err}`);
      const retryAfter = Number(res.headers?.get('retry-after'));
      if (Number.isFinite(retryAfter) && retryAfter > 0) {
        e.retryAfterMs = Math.min(retryAfter * 1000, MAX_RETRY_AFTER_MS);
      }
      throw e;
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
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
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
 * Chama os provedores LLM em sequência, com retry, até obter uma
 * resposta não vazia. Compartilhado pelo chat livre (processWithLLM)
 * e pela Curadoria da IA (curarResultados).
 *
 * Em HTTP 429 (rate-limit), espera o tempo indicado pelo header
 * `Retry-After` quando presente (com teto), ou 5s por padrão — mas
 * apenas quando TODOS os provedores tomaram 429 na primeira rodada
 * (rate-limit global). Se algum provedor responde, retorna sem espera.
 * Nunca faz mais de 2 tentativas por chamada — falhas contam na cota
 * diária dos modelos gratuitos.
 *
 * @param {string} systemPrompt
 * @param {object[]} mensagens — mensagens de contexto (role/content)
 * @param {object} [deps] — deps injetáveis para teste
 * @param {Function} [deps.esperar] — substitui setTimeout (relógio)
 * @param {Function} [deps.agora] — relógio injetável (default: Date.now)
 * @returns {Promise<string|null>} — conteúdo cru, ou null se todos falharam
 */
async function completarComLLM(systemPrompt, mensagens, deps = {}) {
  const esperar = deps.esperar || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const agora = deps.agora || (() => Date.now());

  if (PROVIDERS.length === 0) {
    return null;
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    let todos429 = PROVIDERS.length > 0;
    let retryAfterMs = null;

    for (const provider of PROVIDERS) {
      try {
        const reply = await callProvider(provider, [
          { role: 'system', content: systemPrompt },
          ...mensagens,
        ]);

        // Provider retornou null (conteúdo vazio) → tenta próximo
        if (reply === null) {
          todos429 = false;
          continue;
        }

        return reply;
      } catch (err) {
        console.error(`[${provider.name}]`, err.message);

        if (!err.message.includes('RATE_LIMIT')) {
          todos429 = false;
          continue;
        }

        registrarFalhaLLM(agora());
        if (err.retryAfterMs && err.retryAfterMs > retryAfterMs) {
          retryAfterMs = err.retryAfterMs;
        }
      }
    }

    // Só espera o backoff quando TODOS os provedores da rodada tomaram
    // 429 (rate-limit global). Se algum respondeu, retorna sem esperar.
    if (attempt === 0 && todos429) {
      await esperar(retryAfterMs || RETRY_BACKOFF_MS);
    }
  }

  return null;
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

  const reply = await completarComLLM(systemPrompt, messages);

  // Todos os provedores falharam → erro amigável
  if (reply === null) {
    return '❌ Desculpe, não consegui processar sua mensagem agora. Tente novamente em alguns instantes.';
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
}

module.exports = {
  processWithLLM,
  completarComLLM,
  cleanToolMarkers,
  registrarFalhaLLM,
  llmSaudavel,
};