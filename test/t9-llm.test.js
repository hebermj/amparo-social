const { test } = require('node:test');
const assert = require('node:assert');

// Provedores populados no load do módulo: definir antes do require.
process.env.OPENCODE_ZEN_API_KEY = 'teste-zen';
process.env.OPENROUTER_API_KEY = 'teste-or';

const {
  completarComLLM,
  registrarFalhaLLM,
  llmSaudavel,
} = require('../api/_lib/llm.js');

function respostaJSON(body, { ok = true, status = 200, headers = {} } = {}) {
  return {
    ok,
    status,
    headers: { get: (k) => headers[k] ?? null },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

async function comFetch(mock, deps = {}) {
  const original = global.fetch;
  global.fetch = mock;
  try {
    return await completarComLLM('sistema', [{ role: 'user', content: 'oi' }], deps);
  } finally {
    global.fetch = original;
  }
}

// ── User-Agent do provedor OpenCode Zen ────────────────────────

test('T9: provedor OpenCode Zen envia User-Agent opencode/', async () => {
  const chamadas = [];
  await comFetch(async (url, opts) => {
    chamadas.push({ url: String(url), headers: opts.headers });
    return respostaJSON({ choices: [{ message: { content: 'oi' } }] });
  });
  const zen = chamadas.find((c) => c.url.includes('opencode.ai/zen'));
  assert.ok(zen, 'deve chamar o OpenCode Zen');
  assert.match(zen.headers['User-Agent'] || '', /^opencode\//,
    `User-Agent deve começar com "opencode/": ${JSON.stringify(zen.headers['User-Agent'])}`);
});

// ── Retry com backoff em 429 ───────────────────────────────────

test('T9: 429 dispara retry com backoff padrão (5s) quando não há Retry-After', async () => {
  const esperas = [];
  let chamadas = 0;
  const resposta = await comFetch(async () => {
    chamadas += 1;
    if (chamadas === 1) {
      return respostaJSON({ error: 'rate limit' }, { ok: false, status: 429 });
    }
    return respostaJSON({ choices: [{ message: { content: 'recuperei' } }] });
  }, { esperar: async (ms) => esperas.push(ms) });
  assert.strictEqual(resposta, 'recuperei');
  assert.strictEqual(chamadas, 2, 'deve retentar após o 429');
  assert.ok(esperas.includes(5000), `backoff padrão deve ser 5000ms: ${esperas.join(', ')}`);
});

test('T9: 429 honra Retry-After quando presente', async () => {
  const esperas = [];
  let chamadas = 0;
  const resposta = await comFetch(async () => {
    chamadas += 1;
    if (chamadas === 1) {
      return respostaJSON({ error: 'rate limit' }, {
        ok: false,
        status: 429,
        headers: { 'retry-after': '7' },
      });
    }
    return respostaJSON({ choices: [{ message: { content: 'recuperei' } }] });
  }, { esperar: async (ms) => esperas.push(ms) });
  assert.strictEqual(resposta, 'recuperei');
  assert.ok(esperas.includes(7000), `deve honrar Retry-After de 7s: ${esperas.join(', ')}`);
});

test('T9: não passa de 2 tentativas por chamada quando o 429 persiste', async () => {
  const esperas = [];
  let chamadas = 0;
  const resposta = await comFetch(async () => {
    chamadas += 1;
    return respostaJSON({ error: 'rate limit' }, { ok: false, status: 429 });
  }, { esperar: async (ms) => esperas.push(ms) });
  assert.strictEqual(resposta, null, 'sem resposta após todos os retries');
  assert.strictEqual(chamadas, 4, '2 tentativas × 2 provedores');
  assert.strictEqual(esperas.length, 2, 'backoff apenas na primeira tentativa');
});

// ── Tracker de saúde da LLM (folga de rate-limit) ──────────────

test('T9: registrarFalhaLLM/llmSaudavel usam janela deslizante de 5 min', () => {
  const base = Date.now() + 10_000_000;
  assert.strictEqual(llmSaudavel(base), true, 'saudável antes de qualquer falha');
  registrarFalhaLLM(base - 60_000);
  assert.strictEqual(llmSaudavel(base), false, 'não-saudável dentro da janela');
  assert.strictEqual(llmSaudavel(base + 5 * 60 * 1000 + 1000), true, 'saudável após a janela');
});

test('T9: um 429 real registra falha no tracker de saúde', async () => {
  const base = Date.now() + 20_000_000;
  let chamadas = 0;
  await comFetch(async () => {
    chamadas += 1;
    if (chamadas === 1) {
      return respostaJSON({ error: 'rate limit' }, { ok: false, status: 429 });
    }
    return respostaJSON({ choices: [{ message: { content: 'recuperei' } }] });
  }, { esperar: async () => {}, agora: () => base });
  assert.strictEqual(llmSaudavel(base + 60_000), false,
    'falha registrada deve marcar a LLM como não-saudável');
});