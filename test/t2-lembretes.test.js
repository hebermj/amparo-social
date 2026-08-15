const { test } = require('node:test');
const assert = require('node:assert');

const { lembretesDevidos, atividadesFuturas, horaLocal } = require('../api/_lib/proativo.js');

function sessao(chatId, prefHorario, extras = {}) {
  return { chatId, user: { nome: 'Maria', pref_horario: prefHorario }, ...extras };
}

// Hora de Brasília (UTC-3): 09:00 local = 12:00 UTC
const UTC = (iso) => new Date(`${iso}Z`);

test('T2: lembretesDevidos retorna sessões cujo horário corresponde a agora (fuso BR)', () => {
  const agora = UTC('2026-08-15T12:00:00'); // 09:00 em Brasília
  const devidos = lembretesDevidos([
    sessao(1, '09:00'),
    sessao(2, '14:00'),
    sessao(3, '09:30'),
  ], agora);
  assert.deepStrictEqual(devidos.map((s) => s.chatId), [1]);
});

test('T2: horário diferente (mesmo dia) não é devido', () => {
  const agora = UTC('2026-08-15T12:30:00'); // 09:30 em Brasília
  const devidos = lembretesDevidos([
    sessao(1, '09:00'),
    sessao(2, '09:30'),
  ], agora);
  assert.deepStrictEqual(devidos.map((s) => s.chatId), [2]);
});

test('T2: horário default 09:00 aplicado quando pref_horario ausente', () => {
  const agora = UTC('2026-08-15T12:00:00'); // 09:00 em Brasília
  const devidos = lembretesDevidos([
    { chatId: 1, user: { nome: 'José' } },
    { chatId: 2, user: { nome: 'Maria', pref_horario: '18:00' } },
  ], agora);
  assert.deepStrictEqual(devidos.map((s) => s.chatId), [1]);
});

test('T2: sessão sem perfil não recebe lembrete', () => {
  const agora = UTC('2026-08-15T12:00:00');
  const devidos = lembretesDevidos([{ chatId: 1 }], agora);
  assert.deepStrictEqual(devidos, []);
});

test('T2: horário com hora sem zero à esquerda (9:00) corresponde a 09:00', () => {
  const agora = UTC('2026-08-15T12:00:00'); // 09:00 em Brasília
  const devidos = lembretesDevidos([sessao(1, '9:00')], agora);
  assert.deepStrictEqual(devidos.map((s) => s.chatId), [1]);
});

test('T2: sessão já notificada no mesmo dia não é devida (idempotência)', () => {
  const agora = UTC('2026-08-15T12:00:00');
  const ontem = UTC('2026-08-14T12:00:00');
  const devidos = lembretesDevidos([
    sessao(1, '09:00', { ultimoLembreteEm: agora.toISOString() }),
    sessao(2, '09:00', { ultimoLembreteEm: ontem.toISOString() }),
  ], agora);
  assert.deepStrictEqual(devidos.map((s) => s.chatId), [2]);
});

test('T2: horaLocal converte para fuso de Brasília (UTC-3)', () => {
  const agora = UTC('2026-08-15T12:30:00');
  assert.deepStrictEqual(horaLocal(agora), { hh: '09', mm: '30' });
});

test('T2: atividadesFuturas ignora atividades no passado', () => {
  const agora = new Date('2026-08-15T10:00:00');
  const ats = [
    { nome: 'Passada', data_hora: '2026-08-10T09:00:00' },
    { nome: 'Hoje', data_hora: '2026-08-15T11:00:00' },
    { nome: 'Amanhã', data_hora: '2026-08-16T09:00:00' },
  ];
  assert.deepStrictEqual(
    atividadesFuturas(ats, agora).map((a) => a.nome),
    ['Hoje', 'Amanhã']
  );
});

test('T2: atividadesFuturas ordena por data mais próxima primeiro', () => {
  const agora = new Date('2026-08-15T10:00:00');
  const ats = [
    { nome: 'Mais longe', data_hora: '2026-09-01T09:00:00' },
    { nome: 'Mais perto', data_hora: '2026-08-16T09:00:00' },
  ];
  assert.deepStrictEqual(
    atividadesFuturas(ats, agora).map((a) => a.nome),
    ['Mais perto', 'Mais longe']
  );
});