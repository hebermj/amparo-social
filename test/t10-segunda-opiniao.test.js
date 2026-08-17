const { test } = require('node:test');
const assert = require('node:assert');

const {
  parseDecisaoPedido,
  segundaOpiniaoPadrao,
} = require('../api/_lib/pedido-atividades.js');
const { processarPedidoDeAtividades } = require('../api/_lib/pedido-atividades.js');

function atividadeBase(nome, extras = {}) {
  return {
    nome,
    endereco: 'Rua das Flores, 120',
    data_hora: '2026-08-20T14:00:00',
    ...extras,
  };
}

// ── parseDecisaoPedido (função pura) ───────────────────────────

test('T10: parseDecisaoPedido aceita apenas SIM explícito', () => {
  assert.strictEqual(parseDecisaoPedido('sim'), true);
  assert.strictEqual(parseDecisaoPedido('SIM'), true);
  assert.strictEqual(parseDecisaoPedido('  sim  '), true);
  assert.strictEqual(parseDecisaoPedido('não'), false);
  assert.strictEqual(parseDecisaoPedido('nao'), false);
  assert.strictEqual(parseDecisaoPedido('talvez'), false);
  assert.strictEqual(parseDecisaoPedido(''), false);
  assert.strictEqual(parseDecisaoPedido(null), false);
  assert.strictEqual(parseDecisaoPedido('sim, acho que sim'), false, 'apenas SIM estrito');
});

// ── segundaOpiniaoPadrao ───────────────────────────────────────

test('T10: LLM saudável + resposta "sim" → true', async () => {
  const deps = {
    completar: async () => 'sim',
    saudavel: () => true,
  };
  const decisao = await segundaOpiniaoPadrao('algo mais perto de pinheiros?', { user: {} }, deps);
  assert.strictEqual(decisao, true);
});

test('T10: LLM saudável + resposta "não" → false', async () => {
  const deps = {
    completar: async () => 'não',
    saudavel: () => true,
  };
  const decisao = await segundaOpiniaoPadrao('isso não é perto de casa', { user: {} }, deps);
  assert.strictEqual(decisao, false);
});

test('T10: LLM não-saudável → false sem chamar a LLM', async () => {
  let chamadasCompletar = 0;
  const deps = {
    completar: async () => { chamadasCompletar += 1; return 'sim'; },
    saudavel: () => false,
  };
  const decisao = await segundaOpiniaoPadrao('algo mais perto?', { user: {} }, deps);
  assert.strictEqual(decisao, false);
  assert.strictEqual(chamadasCompletar, 0, 'não deve consumir cota quando não há folga');
});

test('T10: completar retorna null → false', async () => {
  const deps = {
    completar: async () => null,
    saudavel: () => true,
  };
  const decisao = await segundaOpiniaoPadrao('algo mais perto?', { user: {} }, deps);
  assert.strictEqual(decisao, false);
});

test('T10: completar lança erro → false (sem quebrar)', async () => {
  const deps = {
    completar: async () => { throw new Error('RATE_LIMIT'); },
    saudavel: () => true,
  };
  const decisao = await segundaOpiniaoPadrao('algo mais perto?', { user: {} }, deps);
  assert.strictEqual(decisao, false);
});

test('T10: resposta inválida (free-text) → false', async () => {
  const deps = {
    completar: async () => 'Sim, o usuário parece querer algo perto de casa.',
    saudavel: () => true,
  };
  const decisao = await segundaOpiniaoPadrao('algo mais perto?', { user: {} }, deps);
  assert.strictEqual(decisao, false, 'apenas SIM estrito confirma');
});

// ── Integração: orquestrador + segunda opinião real ────────────

test('T10: heurística false + segunda opinião real confirma → recomendação', async () => {
  const session = {
    user: { cidade: 'Santo André', interesses: ['cultura'] },
    history: [],
  };
  const resposta = await processarPedidoDeAtividades('Meu nome é Maria, me indica uma opção', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => [],
    segundaOpiniao: (texto, s) => segundaOpiniaoPadrao(texto, s, {
      completar: async () => 'sim',
      saudavel: () => true,
    }),
  });
  assert.ok(resposta.includes('Oficina da Base'), 'segunda opinião confirma e pipeline roda');
});

test('T10: heurística false + segunda opinião real nega → vai para o chat (null)', async () => {
  const session = {
    user: { cidade: 'Santo André', interesses: ['cultura'] },
    history: [],
  };
  const resposta = await processarPedidoDeAtividades('Meu nome é Maria', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => [],
    segundaOpiniao: (texto, s) => segundaOpiniaoPadrao(texto, s, {
      completar: async () => 'não',
      saudavel: () => true,
    }),
  });
  assert.strictEqual(resposta, null, 'sem confirmação, mensagem segue para o chat');
});

test('T10: LLM não-saudável → não consome cota e segue para o chat', async () => {
  let chamadasCompletar = 0;
  const session = {
    user: { cidade: 'Santo André', interesses: ['cultura'] },
    history: [],
  };
  const resposta = await processarPedidoDeAtividades('Meu nome é Maria', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => [],
    segundaOpiniao: (texto, s) => segundaOpiniaoPadrao(texto, s, {
      completar: async () => { chamadasCompletar += 1; return 'sim'; },
      saudavel: () => false,
    }),
  });
  assert.strictEqual(resposta, null);
  assert.strictEqual(chamadasCompletar, 0, 'não deve chamar a LLM sem folga de rate-limit');
});