const { test } = require('node:test');
const assert = require('node:assert');

const { parseTools } = require('../api/webhook.js');
const { buildPrompt } = require('../api/_lib/prompt.js');

test('T1: parseTools extrai o horário do marcador [[HORARIO:hh:mm]]', () => {
  const tools = parseTools('[[HORARIO:09:00]] Vou anotar seu horário! 🌻');
  const horario = tools.find((t) => t.type === 'horario');
  assert.ok(horario, 'deve haver uma tool do tipo horario');
  assert.strictEqual(horario.horario, '09:00');
});

test('T1: parseTools aceita horário sem zero à esquerda (ex.: 9:00)', () => {
  const tools = parseTools('[[HORARIO:9:00]]');
  const horario = tools.find((t) => t.type === 'horario');
  assert.ok(horario);
  assert.strictEqual(horario.horario, '9:00');
});

test('T1: parseTools rejeita horário inválido (ex.: 99:99)', () => {
  const tools = parseTools('[[HORARIO:99:99]]');
  assert.ok(!tools.some((t) => t.type === 'horario'), 'horário inválido não deve gerar tool');
});

test('T1: buildPrompt instrui a coleta do horário preferido', () => {
  const prompt = buildPrompt({});
  assert.match(prompt, /horário/i, 'o prompt deve mencionar a coleta do horário');
  assert.match(prompt, /lembrete/i, 'o prompt deve associar horário a lembretes');
});

test('T1: buildPrompt informa o horário já configurado quando existente', () => {
  const prompt = buildPrompt({ user: { nome: 'Maria', pref_horario: '09:00' } });
  assert.match(prompt, /09:00/);
});