const { test } = require('node:test');
const assert = require('node:assert');

const {
  curarResultados,
  montarPromptCuradoria,
  validarCuradoria,
} = require('../api/_lib/curadoria.js');
const { processarPedidoDeAtividades } = require('../api/_lib/pedido-atividades.js');

function atividadeBase(nome, extras = {}) {
  return {
    nome,
    endereco: 'Rua das Flores, 120',
    data_hora: '2026-08-20T14:00:00',
    origem: 'base',
    ...extras,
  };
}

function resultadoWeb(nome, extras = {}) {
  return {
    nome,
    descricao: 'Uma atividade interessante para idosos na região.',
    fonte: 'searxng',
    link: 'https://exemplo.com/atividade',
    origem: 'web',
    ...extras,
  };
}

function sessionPadrao() {
  return {
    user: { nome: 'Maria', cidade: 'Santo André', bairro: 'Centro', interesses: ['cultura', 'pintura'] },
    history: [],
  };
}

// ── Prompt da curadoria ─────────────────────────────────────────

test('T2: prompt de curadoria inclui a fusão com origem e instrui a preferir a Base', () => {
  const itens = [
    atividadeBase('Oficina da Base'),
    resultadoWeb('Ateliê da Web'),
  ];
  const prompt = montarPromptCuradoria(itens, sessionPadrao());
  assert.ok(prompt.includes('origem: base'), 'deve marcar a origem base');
  assert.ok(prompt.includes('origem: web'), 'deve marcar a origem web');
  assert.ok(prompt.includes('Prefira itens de origem: base'), 'deve instruir a preferir a Base');
  assert.ok(prompt.includes('Oficina da Base'), 'deve listar a base');
  assert.ok(prompt.includes('Ateliê da Web'), 'deve listar o resultado web');
});

test('T2: prompt de curadoria nunca vaza links crus para a LLM', () => {
  const itens = [resultadoWeb('Ateliê da Web')];
  const prompt = montarPromptCuradoria(itens, sessionPadrao());
  assert.ok(!prompt.includes('https://'), 'URL crua não pode chegar à LLM');
  assert.ok(!prompt.includes('exemplo.com'), 'domínio não pode chegar à LLM');
  assert.ok(prompt.includes('fonte: searxng'), 'deve manter o rótulo de fonte');
});

test('T2: prompt de curadoria usa o perfil do usuário como contexto', () => {
  const prompt = montarPromptCuradoria([atividadeBase('Oficina da Base')], sessionPadrao());
  assert.ok(prompt.includes('Maria'), 'deve incluir o nome');
  assert.ok(prompt.includes('Santo André'), 'deve incluir a cidade');
  assert.ok(prompt.includes('cultura'), 'deve incluir os interesses');
});

// ── Validação da saída ──────────────────────────────────────────

test('T2: validação aceita resposta curada válida', () => {
  const itens = [atividadeBase('Oficina da Base'), resultadoWeb('Ateliê da Web')];
  const valida = validarCuradoria(
    'Recomendo a *Oficina da Base* para você.\n\nTambém vi o *Ateliê da Web* (fonte: searxng).',
    itens
  );
  assert.strictEqual(valida, true);
});

test('T2: validação rejeita conteúdo vazio', () => {
  const itens = [atividadeBase('Oficina da Base')];
  assert.strictEqual(validarCuradoria('', itens), false);
  assert.strictEqual(validarCuradoria('   ', itens), false);
  assert.strictEqual(validarCuradoria(null, itens), false);
});

test('T2: validação rejeita URL crua na resposta', () => {
  const itens = [atividadeBase('Oficina da Base')];
  assert.strictEqual(
    validarCuradoria('Veja mais em https://golpe.com/atividade', itens),
    false
  );
});

test('T2: validação rejeita emojis na resposta', () => {
  const itens = [atividadeBase('Oficina da Base')];
  assert.strictEqual(validarCuradoria('Recomendo a Oficina da Base 😊', itens), false);
});

test('T2: validação rejeita resposta com mais de 2 parágrafos', () => {
  const itens = [atividadeBase('Oficina da Base')];
  const tresParagrafos = [
    'Primeiro parágrafo.',
    'Segundo parágrafo.',
    'Terceiro parágrafo com a Oficina da Base.',
  ].join('\n\n');
  assert.strictEqual(validarCuradoria(tresParagrafos, itens), false);
});

test('T2: validação rejeita resposta que não apresenta nenhuma atividade', () => {
  const itens = [atividadeBase('Oficina da Base')];
  assert.strictEqual(
    validarCuradoria('Não tenho nada para sugerir no momento.', itens),
    false
  );
});

test('T2: validação exige rótulo de fonte quando apresenta item da web', () => {
  const itens = [resultadoWeb('Ateliê da Web')];
  assert.strictEqual(
    validarCuradoria('Recomendo o *Ateliê da Web* para você.', itens),
    false,
    'item web sem fonte deve ser rejeitado'
  );
  assert.strictEqual(
    validarCuradoria('Recomendo o *Ateliê da Web* (fonte: searxng).', itens),
    true,
    'item web com fonte deve passar'
  );
});

test('T2: validação rejeita URL crua com www (sem https)', () => {
  const itens = [atividadeBase('Oficina da Base')];
  assert.strictEqual(
    validarCuradoria('Veja mais em www.exemplo.com/atividade', itens),
    false
  );
});

test('T2: validação é tolerante a acentos e maiúsculas nos nomes', () => {
  const itens = [atividadeBase('Oficina de Cerâmica')];
  assert.strictEqual(
    validarCuradoria('Recomendo a oficina de ceramica para voce.', itens),
    true,
    'nome reescrito sem acento/caixa deve passar'
  );
});

// ── curarResultados (função dedicada) ───────────────────────────

test('T2: curarResultados retorna a resposta curada quando válida', async () => {
  const itens = [atividadeBase('Oficina da Base')];
  const resposta = await curarResultados(itens, sessionPadrao(), {
    completar: async () => 'Recomendo a *Oficina da Base* para você.',
  });
  assert.strictEqual(resposta, 'Recomendo a *Oficina da Base* para você.');
});

test('T2: curarResultados retorna null em falha técnica da LLM', async () => {
  const itens = [atividadeBase('Oficina da Base')];
  const resposta = await curarResultados(itens, sessionPadrao(), {
    completar: async () => { throw new Error('RATE_LIMIT'); },
  });
  assert.strictEqual(resposta, null);
});

test('T2: curarResultados retorna null em conteúdo vazio', async () => {
  const itens = [atividadeBase('Oficina da Base')];
  const resposta = await curarResultados(itens, sessionPadrao(), {
    completar: async () => null,
  });
  assert.strictEqual(resposta, null);
});

test('T2: curarResultados retorna null em saída inválida (URL crua)', async () => {
  const itens = [atividadeBase('Oficina da Base')];
  const resposta = await curarResultados(itens, sessionPadrao(), {
    completar: async () => 'Veja em https://golpe.com/atividade',
  });
  assert.strictEqual(resposta, null);
});

test('T2: curarResultados retorna null em saída sem nenhuma atividade', async () => {
  const itens = [atividadeBase('Oficina da Base')];
  const resposta = await curarResultados(itens, sessionPadrao(), {
    completar: async () => 'Não tenho nada para sugerir no momento.',
  });
  assert.strictEqual(resposta, null);
});

// ── Orquestrador: curadoria no fluxo ────────────────────────────

test('T2: orquestrador usa a resposta curada quando válida', async () => {
  const session = sessionPadrao();
  const resposta = await processarPedidoDeAtividades('Quero atividades de cultura', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => [resultadoWeb('Ateliê da Web')],
    curar: async (itens, s) => {
      assert.ok(itens.some((i) => i.origem === 'base'), 'deve receber a fusão com origem');
      assert.ok(itens.some((i) => i.origem === 'web'), 'deve receber a fusão com origem');
      return 'Escolhi para você: *Oficina da Base* e *Ateliê da Web*.';
    },
  });
  assert.ok(resposta.includes('Escolhi para você'), `resposta curada: "${resposta}"`);
});

test('T2: orquestrador cai no template quando a curadoria falha', async () => {
  const session = sessionPadrao();
  const resposta = await processarPedidoDeAtividades('Quero atividades de cultura', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => [resultadoWeb('Ateliê da Web')],
    curar: async () => null,
  });
  assert.ok(resposta.includes('Oficina da Base'), 'template deve listar a base');
  assert.ok(resposta.includes('Ateliê da Web'), 'template deve listar o resultado web');
  assert.ok(resposta.includes('Fonte:'), 'template deve mostrar rótulo de fonte');
});

test('T2: orquestrador cai no template com saída inválida da curadoria', async () => {
  const session = sessionPadrao();
  const resposta = await processarPedidoDeAtividades('Quero atividades de cultura', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => [],
    curar: (itens, s) => curarResultados(itens, s, {
      completar: async () => 'Veja mais em https://golpe.com',
    }),
  });
  assert.ok(!resposta.includes('https://'), 'template não pode conter URL crua');
  assert.ok(resposta.includes('Oficina da Base'), 'template deve listar a base');
});

test('T2: orquestrador faz UMA única chamada de curadoria por pedido', async () => {
  const session = sessionPadrao();
  let chamadas = 0;
  await processarPedidoDeAtividades('Quero atividades de cultura', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => [resultadoWeb('Ateliê da Web')],
    curar: async (itens) => { chamadas += 1; return 'Escolhi a Oficina da Base.'; },
  });
  assert.strictEqual(chamadas, 1, 'deve ser exatamente uma chamada de curadoria');
});

test('T2: pedido e resposta curada entram no histórico', async () => {
  const session = sessionPadrao();
  await processarPedidoDeAtividades('Quero atividades de cultura', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => [],
    curar: async () => 'Escolhi a *Oficina da Base* para você.',
  });
  assert.strictEqual(session.history.length, 2);
  assert.strictEqual(session.history[0].content, 'Quero atividades de cultura');
  assert.ok(session.history[1].content.includes('Escolhi a *Oficina da Base*'));
});

test('T2: sem curadoria injetada o default curarResultados é usado (fallback template)', async () => {
  const session = sessionPadrao();
  const resposta = await processarPedidoDeAtividades('Quero atividades de cultura', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => [],
  });
  // PROVIDERS vazio em teste → completarComLLM retorna null → template do T1
  assert.ok(resposta.includes('Oficina da Base'), 'deve cair no template do T1');
});