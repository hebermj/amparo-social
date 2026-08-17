const { test } = require('node:test');
const assert = require('node:assert');

const { buscarPorTermo } = require('../api/_lib/search.js');

function respostaJSON(body, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => body };
}

function configurarInstancias(...instances) {
  process.env.SEARXNG_COMMUNITY_INSTANCES = instances.join(',');
}

function limparEnv() {
  delete process.env.SEARXNG_URL;
  delete process.env.SEARXNG_API_KEY;
  delete process.env.SEARXNG_COMMUNITY_INSTANCES;
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

// ── Self-hosted ────────────────────────────────────────────────

test('T8: usa o SearXNG self-hosted quando SEARXNG_URL está configurado', async () => {
  process.env.SEARXNG_URL = 'http://192.168.1.100:4000';
  const chamadas = [];
  const resultados = await comFetch(async (url) => {
    chamadas.push(String(url));
    return respostaJSON({
      results: [{ title: 'Oficina da Web', content: 'Descrição útil', url: 'https://exemplo.com/oficina' }],
    });
  });
  assert.strictEqual(chamadas.length, 1, 'deve consultar apenas o self-hosted');
  assert.ok(chamadas[0].startsWith('http://192.168.1.100:4000/search'), `URL self-hosted: ${chamadas[0]}`);
  assert.strictEqual(resultados.length, 1);
  assert.strictEqual(resultados[0].fonte, 'searxng');
  assert.strictEqual(resultados[0].nome, 'Oficina da Web');
});

test('T8: não consulta instâncias comunitárias quando o self-hosted retorna resultados', async () => {
  process.env.SEARXNG_URL = 'http://192.168.1.100:4000';
  configurarInstancias('https://comunitaria.test');
  const chamadas = [];
  await comFetch(async (url) => {
    chamadas.push(String(url));
    return respostaJSON({ results: [{ title: 'Oficina', content: 'x', url: 'https://x.com/1' }] });
  });
  assert.ok(chamadas.every((u) => u.startsWith('http://192.168.1.100:4000/')),
    `só self-hosted deve ser consultado: ${chamadas.join(', ')}`);
});

// ── Fallback comunitário ───────────────────────────────────────

test('T8: cai para a instância comunitária quando o self-hosted falha', async () => {
  process.env.SEARXNG_URL = 'http://192.168.1.100:4000';
  configurarInstancias('https://comunitaria.test');
  const chamadas = [];
  const resultados = await comFetch(async (url) => {
    chamadas.push(String(url));
    if (String(url).startsWith('http://192.168.1.100:4000/')) {
      return respostaJSON({ error: 'boom' }, { ok: false, status: 500 });
    }
    return respostaJSON({
      results: [{ title: 'Ateliê Comunitário', content: 'desc', url: 'https://c.com/1' }],
    });
  });
  assert.strictEqual(chamadas.length, 2, 'self-hosted + comunitária');
  assert.ok(chamadas[1].startsWith('https://comunitaria.test/search'), `comunitária consultada: ${chamadas[1]}`);
  assert.strictEqual(resultados.length, 1);
  assert.strictEqual(resultados[0].fonte, 'searxng-community');
  assert.strictEqual(resultados[0].nome, 'Ateliê Comunitário');
});

test('T8: cai para a comunitária quando o self-hosted está indisponível (sem SEARXNG_URL)', async () => {
  limparEnv();
  configurarInstancias('https://comunitaria.test');
  const chamadas = [];
  const resultados = await comFetch(async (url) => {
    chamadas.push(String(url));
    return respostaJSON({
      results: [{ title: 'Ateliê da Comunidade', content: 'desc', url: 'https://c.com/2' }],
    });
  });
  assert.strictEqual(chamadas.length, 1);
  assert.ok(chamadas[0].startsWith('https://comunitaria.test/search'));
  assert.strictEqual(resultados.length, 1);
  assert.strictEqual(resultados[0].fonte, 'searxng-community');
});

// ── JSON vazio / instância fora do ar / timeout ────────────────

test('T8: JSON vazio na primeira comunitária tenta a seguinte', async () => {
  limparEnv();
  configurarInstancias('https://vazia.test', 'https://cheia.test');
  const chamadas = [];
  const resultados = await comFetch(async (url) => {
    chamadas.push(String(url));
    if (String(url).startsWith('https://vazia.test/')) {
      return respostaJSON({ results: [] });
    }
    return respostaJSON({ results: [{ title: 'Oficina Cheia', content: 'desc', url: 'https://c.com/3' }] });
  });
  assert.strictEqual(chamadas.length, 2, 'deve tentar a seguinte após JSON vazio');
  assert.strictEqual(resultados.length, 1);
  assert.strictEqual(resultados[0].nome, 'Oficina Cheia');
});

test('T8: instância fora do ar (fetch lança) não derruba a busca', async () => {
  limparEnv();
  configurarInstancias('https://fora-do-ar.test', 'https://cheia.test');
  const chamadas = [];
  const resultados = await comFetch(async (url) => {
    chamadas.push(String(url));
    if (String(url).startsWith('https://fora-do-ar.test/')) {
      throw new Error('fetch failed');
    }
    return respostaJSON({ results: [{ title: 'Oficina Cheia', content: 'desc', url: 'https://c.com/4' }] });
  });
  assert.strictEqual(chamadas.length, 2);
  assert.strictEqual(resultados.length, 1);
  assert.strictEqual(resultados[0].nome, 'Oficina Cheia');
});

test('T8: timeout (AbortError) em todas as instâncias retorna lista vazia', async () => {
  limparEnv();
  configurarInstancias('https://comunitaria.test');
  const resultados = await comFetch(async () => {
    throw new Error('The operation was aborted due to timeout');
  });
  assert.deepStrictEqual(resultados, [], 'deve retornar vazio, não lançar');
});

test('T8: todas as instâncias respondem 200 com JSON vazio → retorna vazio', async () => {
  limparEnv();
  configurarInstancias('https://vazia.test', 'https://vazia2.test');
  const resultados = await comFetch(async () => respostaJSON({ results: [] }));
  assert.deepStrictEqual(resultados, []);
});

// ── Aviso de configuração ──────────────────────────────────────

test('T8: avisa quando SEARXNG_URL não está configurado', async () => {
  limparEnv();
  configurarInstancias('https://comunitaria.test');
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