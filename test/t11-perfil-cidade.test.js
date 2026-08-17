// CIDADE_PADRAO é capturada no load do search.js, então precisa estar
// definida ANTES do require abaixo.
const CIDADE_PADRAO_ORIGINAL = process.env.CIDADE_PADRAO;
process.env.CIDADE_PADRAO = 'Santo André';

const { test, after } = require('node:test');
const assert = require('node:assert');

const { processarPedidoDeAtividades } = require('../api/_lib/pedido-atividades.js');

after(() => {
  if (CIDADE_PADRAO_ORIGINAL === undefined) {
    delete process.env.CIDADE_PADRAO;
  } else {
    process.env.CIDADE_PADRAO = CIDADE_PADRAO_ORIGINAL;
  }
});

function sessionPadrao(overrides = {}) {
  return {
    user: { nome: 'Jo', cidade: 'Campinas', bairro: 'Centro', interesses: ['bailes'] },
    history: [],
    ...overrides,
  };
}

async function capturarCidadeETermo(session) {
  const cidadesRecebidas = [];
  const termosRecebidos = [];
  await processarPedidoDeAtividades('Quero atividades de bailes', session, {
    recomendarBase: (cidade) => { cidadesRecebidas.push(cidade); return []; },
    buscarWeb: async (termo) => { termosRecebidos.push(termo); return []; },
  });
  return { cidadesRecebidas, termosRecebidos };
}

test('T11: usa a cidade do perfil (Campinas) no filtro da Base, nunca CIDADE_PADRAO', async () => {
  const { cidadesRecebidas } = await capturarCidadeETermo(sessionPadrao());
  assert.ok(cidadesRecebidas.includes('Campinas'),
    `Base deve filtrar por Campinas, recebeu: ${cidadesRecebidas.join(', ')}`);
  assert.ok(!cidadesRecebidas.includes('Santo André'),
    'nunca deve filtrar por CIDADE_PADRAO com o perfil presente');
});

test('T11: o termo da Busca Web contém a cidade do usuário', async () => {
  const { termosRecebidos } = await capturarCidadeETermo(sessionPadrao());
  const termo = termosRecebidos[0] || '';
  assert.ok(termo.includes('Campinas'), `termo deve conter Campinas: "${termo}"`);
});

test('T11: CIDADE_PADRAO é o fallback apenas quando o perfil não tem cidade', async () => {
  const { cidadesRecebidas, termosRecebidos } = await capturarCidadeETermo({ user: null, history: [] });
  assert.ok(cidadesRecebidas.includes('Santo André'),
    `sem perfil deve usar CIDADE_PADRAO, recebeu: ${cidadesRecebidas.join(', ')}`);
  const termo = termosRecebidos[0] || '';
  assert.ok(termo.includes('Santo André'), `termo deve usar CIDADE_PADRAO: "${termo}"`);
});

test('T11: perfil sem cidade cai no fallback; com cidade mantém a cidade informada', async () => {
  const semCidade = await capturarCidadeETermo({ user: { nome: 'Jo', bairro: 'Centro' }, history: [] });
  assert.ok(semCidade.cidadesRecebidas.includes('Santo André'), 'sem cidade → CIDADE_PADRAO');
  const comCidade = await capturarCidadeETermo(sessionPadrao());
  assert.ok(comCidade.cidadesRecebidas.includes('Campinas'), 'com cidade → cidade do usuário');
});
