const { test } = require('node:test');
const assert = require('node:assert');

const {
  processarPedidoDeAtividades,
  parecePedidoDeAtividades,
  montarTermoPadrao,
} = require('../api/_lib/pedido-atividades.js');
const { montarTermoBusca } = require('../api/_lib/search.js');

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

// ── Detecção por heurística ────────────────────────────────────

test('T4: parecePedidoDeAtividades reconhece pedidos de atividade', () => {
  const pedidos = [
    'O que tem pra fazer hoje?',
    'Quero atividades de cultura',
    'tem alguma oficina de cerâmica?',
    'vai ter algum evento?',
    'quais atividades vocês recomendam?',
    'me sugere algo pra fazer',
  ];
  for (const pedido of pedidos) {
    assert.ok(parecePedidoDeAtividades(pedido), `deveria detectar: "${pedido}"`);
  }
});

test('T4: parecePedidoDeAtividades reconhece pedidos de refinamento', () => {
  const refinamentos = [
    'isso não é perto de casa, algo mais perto de pinheiros?',
    'algo mais perto de pinheiros?',
    'tem algo mais perto?',
    'tem algo mais perto de casa?',
    'outra opção mais perto?',
    'não é perto de casa, tem outra?',
    'algo mais próximo?',
    'existe algo mais perto do meu bairro?',
  ];
  for (const ref of refinamentos) {
    assert.ok(parecePedidoDeAtividades(ref), `deveria detectar refinamento: "${ref}"`);
  }
});

test('T4: parecePedidoDeAtividades não dispara em conversa comum', () => {
  const naoPedidos = [
    'Meu nome é Maria',
    'Que horas são?',
    'Vou dormir agora',
    'Obrigado',
  ];
  for (const msg of naoPedidos) {
    assert.ok(!parecePedidoDeAtividades(msg), `não deveria detectar: "${msg}"`);
  }
});

// ── Termo de busca ─────────────────────────────────────────────

test('T4: montarTermoBusca usa o termo específico da mensagem', () => {
  const termo = montarTermoBusca('tem aula de cerâmica?', ['pintura'], 'Santo André');
  assert.ok(termo.includes('cerâmica'), `termo deve conter "cerâmica": "${termo}"`);
  assert.ok(termo.includes('Santo André'), `termo deve conter a cidade: "${termo}"`);
  assert.ok(termo.includes('idosos'), `termo deve conter o público: "${termo}"`);
});

test('T4: montarTermoBusca cai para interesses do perfil sem termo específico', () => {
  const termo = montarTermoBusca('O que tem pra fazer hoje?', ['pintura', 'arte'], 'Santo André');
  assert.ok(termo.includes('pintura'), `termo deve usar interesses: "${termo}"`);
  assert.ok(termo.includes('arte'), `termo deve usar interesses: "${termo}"`);
});

test('T4: montarTermoBusca limpa ruído de refinamento (mais perto/outra)', () => {
  const termo = montarTermoBusca('isso não é perto de casa, algo mais perto de pinheiros?', ['leitura'], 'São Paulo');
  assert.ok(termo.includes('pinheiros'), `termo deve manter o bairro pedido: "${termo}"`);
  assert.ok(termo.includes('São Paulo'), `termo deve manter a cidade: "${termo}"`);
  assert.ok(!termo.includes('perto'), `termo não deve conter "perto": "${termo}"`);
  assert.ok(!termo.includes('casa'), `termo não deve conter "casa": "${termo}"`);
  assert.ok(!termo.includes('isso'), `termo não deve conter "isso": "${termo}"`);
});

test('T4: montarTermoPadrao usa CIDADE_PADRAO quando o perfil é incompleto', () => {
  const termo = montarTermoPadrao('tem aula de cerâmica?', { user: null });
  assert.ok(termo.includes('cerâmica'), `termo com perfil nulo: "${termo}"`);
});

// ── Orquestrador: fluxo de atividade ───────────────────────────

test('T4: retorna null quando a mensagem não é um pedido de atividade', async () => {
  const session = { user: null, history: [] };
  const resposta = await processarPedidoDeAtividades('Meu nome é Maria', session);
  assert.strictEqual(resposta, null);
});

// ── Segunda opinião (seam injetável) ───────────────────────────

test('T4: heurística true não chama a segunda opinião', async () => {
  let segundaChamada = 0;
  const session = {
    user: { cidade: 'Santo André', interesses: ['cultura'] },
    history: [],
  };
  await processarPedidoDeAtividades('Quero atividades de cultura', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => [],
    segundaOpiniao: async () => { segundaChamada += 1; return true; },
  });
  assert.strictEqual(segundaChamada, 0, 'segunda opinião não deve rodar quando a heurística confirma');
});

test('T4: heurística false + segunda opinião true → pipeline roda', async () => {
  let buscasWeb = 0;
  let segundaChamada = 0;
  const session = {
    user: { cidade: 'Santo André', interesses: ['cultura'] },
    history: [],
  };
  const resposta = await processarPedidoDeAtividades('Meu nome é Maria, me indica uma opção', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => { buscasWeb += 1; return [resultadoWeb('Ateliê da Web')]; },
    segundaOpiniao: async () => { segundaChamada += 1; return true; },
  });
  assert.strictEqual(segundaChamada, 1, 'segunda opinião deve ser consultada após a heurística falhar');
  assert.strictEqual(buscasWeb, 1, 'a busca web deve rodar após a segunda opinião confirmar');
  assert.ok(resposta.includes('Oficina da Base'), 'base deve aparecer');
});

test('T4: heurística false + segunda opinião false → retorna null', async () => {
  let segundaChamada = 0;
  const session = {
    user: { cidade: 'Santo André', interesses: ['cultura'] },
    history: [],
  };
  const resposta = await processarPedidoDeAtividades('Meu nome é Maria', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => [],
    segundaOpiniao: async () => { segundaChamada += 1; return false; },
  });
  assert.strictEqual(segundaChamada, 1, 'segunda opinião deve ser consultada');
  assert.strictEqual(resposta, null, 'sem confirmação da segunda opinião não é pedido');
});

test('T4: sem segunda opinião injetada, comportamento atual é preservado', async () => {
  const session = { user: null, history: [] };
  const resposta = await processarPedidoDeAtividades('Meu nome é Maria', session);
  assert.strictEqual(resposta, null, 'sem segunda opinião, heurística false → null como antes');
});

test('T4: busca web roda SEMPRE, mesmo com base suficiente', async () => {
  let buscasWeb = 0;
  const session = {
    user: { nome: 'Maria', cidade: 'Santo André', bairro: 'Centro', interesses: ['cultura'] },
    history: [],
  };
  const resposta = await processarPedidoDeAtividades('Quero atividades de cultura', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => { buscasWeb += 1; return [resultadoWeb('Ateliê da Web')]; },
  });
  assert.strictEqual(buscasWeb, 1, 'busca web deve rodar sempre');
  assert.ok(resposta.includes('Oficina da Base'), 'base deve aparecer');
  assert.ok(resposta.includes('Ateliê da Web'), 'resultado web deve aparecer');
});

test('T4: amplia para outros bairros quando o bairro do usuário não atende', async () => {
  const session = {
    user: { cidade: 'Santo André', bairro: 'Centro', interesses: ['cultura'] },
    history: [],
  };
  let chamadas = 0;
  const resposta = await processarPedidoDeAtividades('Quero atividades de cultura', session, {
    recomendarBase: (cidade, bairro, interesses) => {
      chamadas += 1;
      if (bairro === 'Centro') return [];
      return [atividadeBase('Oficina do Bairro Vizinho')];
    },
    buscarWeb: async () => [],
  });
  assert.strictEqual(chamadas, 2, 'deve tentar sem o bairro restritivo');
  assert.ok(resposta.includes('Oficina do Bairro Vizinho'), 'deve encontrar em outro bairro');
});

test('T4: falha da busca web não derruba o fluxo', async () => {
  const session = {
    user: { cidade: 'Santo André', interesses: ['cultura'] },
    history: [],
  };
  const resposta = await processarPedidoDeAtividades('Quero atividades de cultura', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => { throw new Error('timeout'); },
  });
  assert.ok(resposta.includes('Oficina da Base'), 'deve cair na base sem lançar exceção');
});

test('T4: sem base nem web entrega a mensagem de vazio', async () => {
  const session = {
    user: { cidade: 'Santo André', interesses: ['cultura'] },
    history: [],
  };
  const resposta = await processarPedidoDeAtividades('Quero atividades de cultura', session, {
    recomendarBase: () => [],
    buscarWeb: async () => [],
  });
  assert.ok(resposta.includes('Não encontrei'), `mensagem de vazio: "${resposta}"`);
});

test('T4: nunca expõe URLs cruas dos resultados da web', async () => {
  const session = {
    user: { cidade: 'Santo André', interesses: ['cerâmica'] },
    history: [],
  };
  const resposta = await processarPedidoDeAtividades('tem aula de cerâmica?', session, {
    recomendarBase: () => [],
    buscarWeb: async () => [resultadoWeb('Ateliê de Cerâmica')],
  });
  assert.ok(!resposta.includes('https://'), `não deve expor URLs: "${resposta}"`);
  assert.ok(resposta.includes('Fonte:'), 'deve mostrar rótulo de fonte');
});

test('T4: pedido e resposta entram no histórico da sessão', async () => {
  const session = {
    user: { cidade: 'Santo André', interesses: ['cultura'] },
    history: [],
  };
  await processarPedidoDeAtividades('Quero atividades de cultura', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => [],
  });
  assert.strictEqual(session.history.length, 2);
  assert.strictEqual(session.history[0].role, 'user');
  assert.strictEqual(session.history[0].content, 'Quero atividades de cultura');
  assert.strictEqual(session.history[1].role, 'assistant');
  assert.ok(session.history[1].content.includes('Oficina da Base'));
});

test('T4: /atividades entra no mesmo pipeline (sem depender da LLM)', async () => {
  const session = {
    user: { cidade: 'Santo André', bairro: 'Centro', interesses: ['cultura'] },
    history: [],
  };
  const resposta = await processarPedidoDeAtividades('/atividades', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => [resultadoWeb('Ateliê da Web')],
  });
  assert.ok(resposta.includes('Oficina da Base'));
  assert.ok(resposta.includes('Ateliê da Web'));
});

test('T4: perfil incompleto ainda entrega recomendação (CIDADE_PADRAO)', async () => {
  const session = { user: null, history: [] };
  const resposta = await processarPedidoDeAtividades('Quero atividades de cultura', session, {
    recomendarBase: () => [atividadeBase('Oficina da Base')],
    buscarWeb: async () => [],
  });
  assert.ok(resposta.includes('Oficina da Base'), 'deve recomendar mesmo sem perfil completo');
});