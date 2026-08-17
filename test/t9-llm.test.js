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

test('T9: backoff padrão (5s) quando todos os provedores tomam 429 na 1ª rodada', async () => {
  const esperas = [];
  let chamadas = 0;
  const resposta = await comFetch(async () => {
    chamadas += 1;
    if (chamadas <= 2) {
      return respostaJSON({ error: 'rate limit' }, { ok: false, status: 429 });
    }
    return respostaJSON({ choices: [{ message: { content: 'recuperei' } }] });
  }, { esperar: async (ms) => esperas.push(ms) });
  assert.strictEqual(resposta, 'recuperei');
  assert.strictEqual(chamadas, 3, '2 (1ª rodada 429) + 1 (2ª rodada, primeiro provedor)');
  assert.deepStrictEqual(esperas, [5000], `um único backoff de 5s: ${esperas.join(', ')}`);
});

test('T9: 429 de um provedor + sucesso do outro → não espera backoff', async () => {
  const esperas = [];
  let chamadas = 0;
  const resposta = await comFetch(async (url) => {
    chamadas += 1;
    if (String(url).includes('opencode.ai')) {
      return respostaJSON({ error: 'rate limit' }, { ok: false, status: 429 });
    }
    return respostaJSON({ choices: [{ message: { content: 'funcionou' } }] });
  }, { esperar: async (ms) => esperas.push(ms) });
  assert.strictEqual(resposta, 'funcionou');
  assert.strictEqual(chamadas, 2, '429 no Zen + sucesso no OpenRouter');
  assert.deepStrictEqual(esperas, [], 'não deve esperar quando um provedor responde');
});

test('T9: Retry-After é honrado quando todos os provedores tomam 429', async () => {
  const esperas = [];
  let chamadas = 0;
  const resposta = await comFetch(async () => {
    chamadas += 1;
    if (chamadas <= 2) {
      return respostaJSON({ error: 'rate limit' }, {
        ok: false,
        status: 429,
        headers: { 'retry-after': '7' },
      });
    }
    return respostaJSON({ choices: [{ message: { content: 'recuperei' } }] });
  }, { esperar: async (ms) => esperas.push(ms) });
  assert.strictEqual(resposta, 'recuperei');
  assert.deepStrictEqual(esperas, [7000], `deve honrar Retry-After de 7s: ${esperas.join(', ')}`);
});

test('T9: Retry-After é limitado a um teto (não pendura a resposta)', async () => {
  const esperas = [];
  let chamadas = 0;
  const resposta = await comFetch(async () => {
    chamadas += 1;
    if (chamadas <= 2) {
      return respostaJSON({ error: 'rate limit' }, {
        ok: false,
        status: 429,
        headers: { 'retry-after': '300' },
      });
    }
    return respostaJSON({ choices: [{ message: { content: 'ok' } }] });
  }, { esperar: async (ms) => esperas.push(ms) });
  assert.strictEqual(resposta, 'ok');
  assert.ok(esperas.every((ms) => ms <= 10000), `espera deve ser limitada: ${esperas.join(', ')}`);
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
  assert.strictEqual(esperas.length, 1, 'um único backoff na 1ª rodada');
});

test('T9: fetch da LLM envia AbortSignal com timeout', async () => {
  const sinais = [];
  const original = global.fetch;
  global.fetch = async (url, opts) => {
    sinais.push(opts.signal);
    return respostaJSON({ choices: [{ message: { content: 'oi' } }] });
  };
  try {
    await completarComLLM('sistema', [{ role: 'user', content: 'oi' }], {});
  } finally {
    global.fetch = original;
  }
  assert.ok(sinais.length > 0, 'deve passar signal ao fetch');
  assert.ok(sinais.every((s) => s instanceof AbortSignal),
    'deve ser um AbortSignal (timeout do fetch)');
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