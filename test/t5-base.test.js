const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ARQUIVO = path.join(__dirname, '..', 'data', 'atividades-santo-andre.json');

test('T5: toda atividade da base tem data_hora no futuro (não defasada)', () => {
  const atividades = JSON.parse(fs.readFileSync(ARQUIVO, 'utf-8'));
  const agora = Date.now();
  for (const a of atividades) {
    const data = new Date(a.data_hora).getTime();
    assert.ok(
      data > agora,
      `Atividade "${a.nome}" (id ${a.id}) tem data passada: ${a.data_hora}`
    );
  }
});

test('T5: base possui atividades (não vazia)', () => {
  const atividades = JSON.parse(fs.readFileSync(ARQUIVO, 'utf-8'));
  assert.ok(atividades.length > 0, 'a base não deve estar vazia');
});