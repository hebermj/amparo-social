const { test } = require('node:test');
const assert = require('node:assert');

const { inativosDesde } = require('../api/_lib/proativo.js');

function sessao(chatId, ultimaInteracaoEm) {
  return { chatId, user: { nome: 'Maria' }, ultimaInteracaoEm };
}

const agora = new Date('2026-08-15T12:00:00Z');
const dias = (n) => new Date(agora.getTime() - n * 24 * 3600 * 1000).toISOString();

test('T3: inativosDesde retorna sessões sem interação há 3+ dias', () => {
  const inativos = inativosDesde([
    sessao(1, dias(5)),
    sessao(2, dias(1)),
    sessao(3, dias(3)),
  ], 3, agora);
  assert.deepStrictEqual(inativos.map((s) => s.chatId), [1, 3]);
});

test('T3: usuário ativo recente NÃO é retornado', () => {
  const inativos = inativosDesde([
    sessao(1, dias(2)),
    sessao(2, agora.toISOString()),
  ], 3, agora);
  assert.deepStrictEqual(inativos, []);
});

test('T3: sessão sem interação registrada não é retornada', () => {
  const inativos = inativosDesde([{ chatId: 1, user: { nome: 'José' } }], 3, agora);
  assert.deepStrictEqual(inativos, []);
});

test('T3: sessão com mais de N dias também é retornada', () => {
  const inativos = inativosDesde([sessao(1, dias(10))], 3, agora);
  assert.deepStrictEqual(inativos.map((s) => s.chatId), [1]);
});