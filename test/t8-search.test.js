const { test } = require('node:test');
const assert = require('node:assert');

const { buscarPorTermo } = require('../api/_lib/search.js');

function respostaJSON(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

function limparEnv() {
  delete process.env.SEARXNG_URL;
  delete process.env.SEARXNG_USER;
  delete process.env.SEARXNG_PASSWORD;
}

async function comFetch(mock) {
  const original = global.fetch;
  global.fetch = mock;
  try {
    return await buscarPorTermo('cerâmica idosos atividades');
  } finally {
    global.fetch = original;
    limparEnv();
  }
}

// ── Instância SearXNG Própria (única provedora) ─────────────────

test('T8: usa a Instância SearXNG Própria quando SEARXNG_URL está configurado', async () => {
  process.env.SEARXNG_URL = 'https://amparo-searxng.example';
  const chamadas = [];
  const resultados = await comFetch(async (url) => {
    chamadas.push(String(url));
    return respostaJSON({
      results: [{ title: 'Oficina da Web', content: 'Descrição útil', url: 'https://exemplo.com/oficina' }],
    });
  });
  assert.strictEqual(chamadas.length, 1, 'deve consultar apenas a Instância');
  assert.ok(chamadas[0].startsWith('https://amparo-searxng.example/search'), `URL da Instância: ${chamadas[0]}`);
  assert.strictEqual(resultados.length, 1);
  assert.strictEqual(resultados[0].fonte, 'searxng');
  assert.strictEqual(resultados[0].nome, 'Oficina da Web');
});

test('T8: envia Authorization Basic com as credenciais configuradas', async () => {
  process.env.SEARXNG_URL = 'https://amparo-searxng.example';
  process.env.SEARXNG_USER = 'usuario';
  process.env.SEARXNG_PASSWORD = 'senha';
  let authHeader = null;
  await comFetch(async (url, opts) => {
    authHeader = opts?.headers?.['Authorization'] ?? null;
    return respostaJSON({ results: [{ title: 'Oficina', content: 'x', url: 'https://x.com/1' }] });
  });
  assert.strictEqual(authHeader, 'Basic dXN1YXJpbzpzZW5oYQ==',
    'deve enviar Authorization: Basic com usuário:senha codificados');
});

test('T8: não envia header de autorização sem credenciais', async () => {
  process.env.SEARXNG_URL = 'https://amparo-searxng.example';
  let authHeader = 'setado';
  await comFetch(async (url, opts) => {
    authHeader = opts?.headers?.['Authorization'] ?? null;
    return respostaJSON({ results: [{ title: 'Oficina', content: 'x', url: 'https://x.com/2' }] });
  });
  assert.strictEqual(authHeader, null, 'sem credenciais, nenhum header de autorização');
});

// ── Fim do fallback comunitário ─────────────────────────────────

test('T8: consulta só a Instância — nunca instâncias comunitárias', async () => {
  process.env.SEARXNG_URL = 'https://amparo-searxng.example';
  const chamadas = [];
  await comFetch(async (url) => {
    chamadas.push(String(url));
    return respostaJSON({ results: [{ title: 'Oficina', content: 'x', url: 'https://x.com/3' }] });
  });
  assert.ok(chamadas.every((u) => u.startsWith('https://amparo-searxng.example/')),
    `só a Instância deve ser consultada: ${chamadas.join(', ')}`);
});

test('T8: sem SEARXNG_URL retorna lista vazia sem consultar nada', async () => {
  limparEnv();
  const chamadas = [];
  const resultados = await comFetch(async (url) => {
    chamadas.push(String(url));
    return respostaJSON({ results: [{ title: 'x', content: 'y', url: 'https://x.com/4' }] });
  });
  assert.deepStrictEqual(chamadas, [], 'nenhuma instância comunitária deve ser consultada');
  assert.deepStrictEqual(resultados, []);
});

// ── Filtro de idioma (defesa em profundidade) ───────────────────

test('T8: descarta Resultados em scripts não-latinos', async () => {
  process.env.SEARXNG_URL = 'https://amparo-searxng.example';
  const resultados = await comFetch(async () => respostaJSON({
    results: [
      { title: '知乎 - 如何看待', content: '中文内容', url: 'https://zhihu.example/1' },
      { title: 'Caminhada no Parque', content: 'Grupo de caminhada para idosos.', url: 'https://exemplo.com/2' },
    ],
  }));
  assert.strictEqual(resultados.length, 1, 'só resultados em latim sobrevivem');
  assert.strictEqual(resultados[0].nome, 'Caminhada no Parque');
});

// ── Falhas da Instância ─────────────────────────────────────────

test('T8: JSON vazio da Instância retorna lista vazia (sem fallback)', async () => {
  process.env.SEARXNG_URL = 'https://amparo-searxng.example';
  const chamadas = [];
  const resultados = await comFetch(async (url) => {
    chamadas.push(String(url));
    return respostaJSON({ results: [] });
  });
  assert.strictEqual(chamadas.length, 1, 'consulta só a Instância');
  assert.deepStrictEqual(resultados, []);
});

test('T8: instância fora do ar (fetch lança) não derruba a busca', async () => {
  process.env.SEARXNG_URL = 'https://amparo-searxng.example';
  const resultados = await comFetch(async () => {
    throw new Error('fetch failed');
  });
  assert.deepStrictEqual(resultados, [], 'deve retornar vazio, não lançar');
});

test('T8: HTTP com erro (401/500) da Instância retorna lista vazia', async () => {
  process.env.SEARXNG_URL = 'https://amparo-searxng.example';
  const chamadas = [];
  const resultados = await comFetch(async (url) => {
    chamadas.push(String(url));
    return respostaJSON({}, { ok: false, status: 401 });
  });
  assert.strictEqual(chamadas.length, 1, 'consulta só a Instância');
  assert.deepStrictEqual(resultados, [], 'erro HTTP não pode quebrar o fluxo');
});

test('T8: timeout (AbortError) retorna lista vazia', async () => {
  process.env.SEARXNG_URL = 'https://amparo-searxng.example';
  const resultados = await comFetch(async () => {
    throw new Error('The operation was aborted due to timeout');
  });
  assert.deepStrictEqual(resultados, []);
});

test('T8: avisa quando SEARXNG_URL não está configurado', async () => {
  limparEnv();
  const avisos = [];
  const originalWarn = console.warn;
  console.warn = (...args) => avisos.push(args.join(' '));
  try {
    await comFetch(async (url) => respostaJSON({
      results: [{ title: 'Oficina', content: 'desc', url: 'https://c.com/5' }],
    }));
  } finally {
    console.warn = originalWarn;
  }
  assert.ok(avisos.some((a) => a.includes('SEARXNG_URL')),
    `deve avisar sobre SEARXNG_URL ausente: ${avisos.join(' | ')}`);
});