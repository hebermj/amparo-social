const { test } = require('node:test');
const assert = require('node:assert');

const { recomendarComFallback, LIMIAR_FALLBACK } = require('../api/_lib/activities.js');

function atvs(n) {
  return Array.from({ length: n }, (_, i) => ({ nome: `Atividade ${i + 1}`, id: i + 1 }));
}

test('T4: base com resultados suficientes (>=limiar) não aciona a busca', async () => {
  let buscaChamada = false;
  const resultado = await recomendarComFallback('Santo André', 'Centro', ['cultura'], {
    base: () => atvs(LIMIAR_FALLBACK),
    buscar: async () => { buscaChamada = true; return atvs(2); },
  });
  assert.strictEqual(resultado.origem, 'base');
  assert.strictEqual(resultado.atividades.length, LIMIAR_FALLBACK);
  assert.strictEqual(buscaChamada, false);
});

test('T4: base insuficiente (<limiar) aciona a busca web', async () => {
  let termoBusca = null;
  const resultado = await recomendarComFallback('Santo André', 'Centro', ['ceramica'], {
    base: () => atvs(LIMIAR_FALLBACK - 1),
    buscar: async (interesses, cidade) => { termoBusca = { interesses, cidade }; return atvs(3); },
  });
  assert.strictEqual(resultado.origem, 'web');
  assert.deepStrictEqual(termoBusca, { interesses: ['ceramica'], cidade: 'Santo André' });
});

test('T4: base vazia aciona a busca web', async () => {
  const resultado = await recomendarComFallback('Santo André', 'Centro', ['cultura'], {
    base: () => [],
    buscar: async () => atvs(2),
  });
  assert.strictEqual(resultado.origem, 'web');
  assert.strictEqual(resultado.atividades.length, 2);
});

test('T4: base vazia e busca sem resultados não lança exceção', async () => {
  const resultado = await recomendarComFallback('Santo André', 'Centro', ['cultura'], {
    base: () => [],
    buscar: async () => [],
  });
  assert.strictEqual(resultado.origem, 'base');
  assert.deepStrictEqual(resultado.atividades, []);
});

test('T4: busca que lança erro não propaga exceção', async () => {
  const resultado = await recomendarComFallback('Santo André', 'Centro', ['cultura'], {
    base: () => [],
    buscar: async () => { throw new Error('timeout'); },
  });
  assert.strictEqual(resultado.origem, 'base');
  assert.deepStrictEqual(resultado.atividades, []);
});