const { test } = require('node:test');
const assert = require('node:assert');

const {
  processarPedidoDeAtividades,
  normalizarTermo,
  obterDoCache,
  guardarNoCache,
  registrarHit,
  noLimite,
} = require('../api/_lib/pedido-atividades.js');

const HORA = 60 * 60 * 1000;

function atividadeBase(nome, extras = {}) {
  return {
    nome,
    endereco: 'Rua das Flores, 120',
    data_hora: '2026-08-20T14:00:00',
    ...extras,
  };
}

function resultadoWeb(nome, extras = {}) {
  return {
    nome,
    descricao: 'Uma atividade interessante para idosos na região.',
    fonte: 'searxng',
    link: 'https://exemplo.com/atividade',
    ...extras,
  };
}

function sessionPadrao() {
  return {
    user: { nome: 'Maria', cidade: 'Santo André', bairro: 'Centro', interesses: ['cultura'] },
    history: [],
    busca: { cache: {}, hits: [] },
  };
}

// ── Helpers puros ───────────────────────────────────────────────

test('T3: normalizarTermo remove acentos e caixa', () => {
  assert.strictEqual(normalizarTermo('Cerâmica Santo André Idosos'), 'ceramica santo andre idosos');
  assert.strictEqual(normalizarTermo('  Música  '), 'musica');
});

test('T3: cache respeita janela de 1h e expira por idade', () => {
  const session = sessionPadrao();
  const t0 = 1_000_000;
  guardarNoCache(session, 'ceramica', [{ nome: 'Ateliê', origem: 'web' }], t0);
  assert.ok(obterDoCache(session, 'ceramica', t0 + HORA - 1), 'dentro da janela deve existir');
  assert.ok(obterDoCache(session, 'ceramica', t0 + HORA), 'exatamente na janela ainda vale');
  assert.strictEqual(obterDoCache(session, 'ceramica', t0 + HORA + 1), null, 'fora da janela expira');
});

test('T3: cache mantém no máximo ~3 termos (evicting mais antigos)', () => {
  const session = sessionPadrao();
  const t0 = 1_000_000;
  guardarNoCache(session, 'a', [1], t0);
  guardarNoCache(session, 'b', [2], t0 + 1000);
  guardarNoCache(session, 'c', [3], t0 + 2000);
  guardarNoCache(session, 'd', [4], t0 + 3000);
  assert.strictEqual(Object.keys(session.busca.cache).length, 3);
  assert.strictEqual(obterDoCache(session, 'a', t0 + 3000), null, 'mais antigo expulso');
  assert.ok(obterDoCache(session, 'b', t0 + 3000), 'segundo mais antigo mantido');
  assert.ok(obterDoCache(session, 'd', t0 + 3000), 'mais novo mantido');
});

test('T3: registrarHit mantém janela de 1h e no máx 10 hits', () => {
  const session = sessionPadrao();
  const t0 = 1_000_000;
  for (let i = 0; i < 12; i++) registrarHit(session, t0 + i * 1000);
  assert.strictEqual(session.busca.hits.length, 10, 'limita a 10 hits');
  registrarHit(session, t0 + 2 * HORA);
  assert.strictEqual(session.busca.hits.length, 1, 'hits antigos expurgados');
});

test('T3: noLimite considera apenas a janela de 1h', () => {
  const session = sessionPadrao();
  const t0 = 1_000_000;
  for (let i = 0; i < 9; i++) registrarHit(session, t0 + i * 1000);
  assert.strictEqual(noLimite(session, t0 + 10_000), false, '9 hits: ainda não estourou');
  registrarHit(session, t0 + 10_000);
  assert.strictEqual(noLimite(session, t0 + 11_000), true, '10 hits: estourou');
  // Avança o relógio além da janela → os 10 hits expiram
  assert.strictEqual(noLimite(session, t0 + 11_000 + HORA), false, 'janela decorrida libera');
});

// ── Orquestrador: cache-hit ─────────────────────────────────────

test('T3: cache-hit entrega template direto sem buscar nem curar', async () => {
  const session = sessionPadrao();
  const t0 = 1_000_000;
  session.busca.cache['quero atividades de cultura'] = {
    ts: t0,
    resultados: [
      { nome: 'Oficina da Base', endereco: 'Sesc', data_hora: '2026-08-20T14:00:00', origem: 'base' },
      { nome: 'Ateliê da Web', descricao: 'Aulas.', fonte: 'searxng', origem: 'web' },
    ],
  };

  let buscasWeb = 0;
  let curas = 0;
  let baseRecomendada = false;
  const resposta = await processarPedidoDeAtividades('quero atividades de cultura', session, {
    montarTermo: () => 'quero atividades de cultura',
    recomendarBase: () => {
      baseRecomendada = true;
      return [atividadeBase('Oficina da Base')];
    },
    buscarWeb: async () => { buscasWeb += 1; return []; },
    curar: async () => { curas += 1; return 'curada'; },
    agora: () => t0 + 1000,
  });

  assert.strictEqual(buscasWeb, 0, 'cache-hit não deve buscar na web');
  assert.strictEqual(curas, 0, 'cache-hit não deve chamar a curadoria');
  assert.ok(baseRecomendada, 'cache-hit re-recomenda a Base fresca');
  assert.strictEqual(session.busca.hits.length, 0, 'cache-hit não conta no rate-limit');
  assert.ok(resposta.includes('Oficina da Base'), 'deve usar o template direto');
  assert.ok(resposta.includes('Ateliê da Web'), 'deve usar o template direto');
});

test('T3: cache-hit de resultado vazio entrega mensagem de vazio', async () => {
  const session = sessionPadrao();
  session.busca.cache['quero atividades de cultura'] = { ts: 1_000_000, resultados: [] };
  const resposta = await processarPedidoDeAtividades('quero atividades de cultura', session, {
    montarTermo: () => 'quero atividades de cultura',
    recomendarBase: () => [],
    buscarWeb: async () => [],
    agora: () => 1_000_100,
  });
  assert.ok(resposta.includes('Não encontrei'), `mensagem de vazio: "${resposta}"`);
});

// ── Orquestrador: rate-limit → Base curada ──────────────────────

test('T3: estouro do rate-limit cai para a Base curada, sem busca web', async () => {
  const session = sessionPadrao();
  const t0 = 1_000_000;
  for (let i = 0; i < 10; i++) registrarHit(session, t0 + i * 1000);

  let buscasWeb = 0;
  let curadosItens = null;
  const resposta = await processarPedidoDeAtividades('Quero atividades de cultura', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => { buscasWeb += 1; return [resultadoWeb('Ateliê da Web')]; },
    curar: async (itens) => { curadosItens = itens; return 'Base curada para você.'; },
    agora: () => t0 + 11_000,
  });

  assert.strictEqual(buscasWeb, 0, 'estouro não deve buscar na web');
  assert.ok(curadosItens, 'deve rodar a curadoria');
  assert.ok(curadosItens.every((i) => i.origem === 'base'), 'curadoria só com a Base');
  assert.ok(resposta.includes('Base curada'), `resposta: "${resposta}"`);
});

test('T3: estouro do rate-limit cai para o template se a curadoria falhar', async () => {
  const session = sessionPadrao();
  const t0 = 1_000_000;
  for (let i = 0; i < 10; i++) registrarHit(session, t0 + i * 1000);
  const resposta = await processarPedidoDeAtividades('Quero atividades de cultura', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => [resultadoWeb('Ateliê da Web')],
    curar: async () => null,
    agora: () => t0 + 11_000,
  });
  assert.ok(resposta.includes('Oficina da Base'), 'template da Base no estouro');
  assert.ok(!resposta.includes('Ateliê da Web'), 'sem resultado web no estouro');
});

test('T3: /atividades e pedidos detectados compartilham o mesmo contador', async () => {
  const session = sessionPadrao();
  const t0 = 1_000_000;
  for (let i = 0; i < 9; i++) registrarHit(session, t0 + i * 1000);

  let buscasWeb = 0;
  await processarPedidoDeAtividades('/atividades', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => { buscasWeb += 1; return [resultadoWeb('Ateliê da Web')]; },
    agora: () => t0 + 10_000,
  });
  assert.strictEqual(buscasWeb, 1, '/atividades conta como busca explícita');

  const resposta = await processarPedidoDeAtividades('Quero atividades de cultura', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => { buscasWeb += 1; return [resultadoWeb('Ateliê da Web')]; },
    agora: () => t0 + 11_000,
  });
  assert.strictEqual(buscasWeb, 1, 'pedido detectado estoura e não busca mais');
  assert.ok(resposta.includes('Oficina da Base'), 'cai para a Base');
});

// ── Orquestrador: cache e hits persistidos na Sessão ────────────

test('T3: após busca, cache e hit ficam na Sessão (sobrevivem a cold start)', async () => {
  const session = sessionPadrao();
  const t0 = 1_000_000;
  await processarPedidoDeAtividades('Quero atividades de cultura', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => [resultadoWeb('Ateliê da Web')],
    curar: async (itens) => 'Curada.',
    agora: () => t0,
  });

  assert.strictEqual(session.busca.hits.length, 1, 'hit registrado na Sessão');
  const chaves = Object.keys(session.busca.cache);
  assert.strictEqual(chaves.length, 1, 'cache preenchido na Sessão');
  const cacheEntry = session.busca.cache[chaves[0]];
  assert.ok(cacheEntry.ts >= t0, 'ts do cache presente');
  assert.ok(cacheEntry.resultados.length >= 1, 'Resultados da Busca cacheados');
  // Simula cold start: sessão relida do banco (mesmo objeto) → cache-hit.
  // O cache guarda só a web; a Base é re-recomendada fresca.
  const resposta2 = await processarPedidoDeAtividades('Quero atividades de cultura', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => [],
    agora: () => t0 + 1000,
  });
  assert.ok(resposta2.includes('Oficina da Base'), 'cache sobrevive ao cold start');
  assert.ok(resposta2.includes('Ateliê da Web'), 'resultados web vêm do cache');
});

test('T3: busca registra cache mesmo sem resultados (chave normalizada)', async () => {
  const session = sessionPadrao();
  const t0 = 1_000_000;
  await processarPedidoDeAtividades('Quero atividades de cultura', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => [],
    agora: () => t0,
  });
  const chave = Object.keys(session.busca.cache)[0];
  assert.ok(!/[À-ú]/.test(chave), 'chave de cache normalizada');
});

test('T3: termo com acento bate no cache normalizado', async () => {
  const session = sessionPadrao();
  const t0 = 1_000_000;
  await processarPedidoDeAtividades('Quero atividades de música', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => [resultadoWeb('Ateliê da Música')],
    agora: () => t0,
  });
  const resposta2 = await processarPedidoDeAtividades('Quero atividades de musica', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => [],
    agora: () => t0 + 1000,
  });
  assert.ok(resposta2.includes('Ateliê da Música'), 'mesmo termo sem acento bate no cache');
});