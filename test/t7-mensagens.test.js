const { test } = require('node:test');
const assert = require('node:assert');

const {
  mensagemStart,
  mensagemSemChaveIA,
  mensagemSemAtividades,
  mensagemAtividades,
  mensagemBuscaPensando,
  mensagemBuscaResultados,
  mensagemBuscaVazia,
  mensagemLembrete,
  mensagemIncentivo,
} = require('../api/_lib/mensagens.js');

const EMOJI = /[\p{Extended_Pictographic}]/u;

const atividade = {
  nome: 'Oficina de Pintura em Tela',
  endereco: 'Sesc — Rua Tamarutaca, 302',
  data_hora: '2026-07-06T14:00:00',
};

test('T7: nenhuma mensagem de código contém emojis', () => {
  const mensagens = [
    mensagemStart(),
    mensagemSemChaveIA(),
    mensagemSemAtividades(),
    mensagemAtividades([atividade], 'base'),
    mensagemAtividades([atividade], 'web'),
    mensagemBuscaPensando(),
    mensagemBuscaResultados([atividade]),
    mensagemBuscaVazia(),
    mensagemLembrete('Maria', atividade),
    mensagemIncentivo('Maria'),
    mensagemIncentivo(null),
  ];
  for (const m of mensagens) {
    assert.doesNotMatch(m, EMOJI, `mensagem sem emojis: ${m.slice(0, 40)}...`);
  }
});

test('T7: mensagemStart corresponde ao novo /start', () => {
  const msg = mensagemStart();
  assert.match(msg, /Sou o \*\*Amparo\*\*/);
  assert.match(msg, /qual é o seu nome\?/);
  assert.doesNotMatch(msg, /Sou o \*\*Amparo\*\*.*🌻/s);
});

test('T7: mensagemAtividades lista atividades numeradas por origem', () => {
  const base = mensagemAtividades([atividade], 'base');
  assert.match(base, /Aqui estão as atividades que encontrei/);
  assert.match(base, /1\. \*Oficina de Pintura em Tela\*/);
  assert.match(base, /Endereço: Sesc/);
  assert.match(base, /_Qual te interessou\? Me fala!_/);

  const web = mensagemAtividades([atividade], 'web');
  assert.match(web, /Encontrei atividades na internet para você/);
});

test('T7: mensagemBuscaResultados limita a 3 resultados', () => {
  const muitos = [
    { nome: 'A', descricao: 'Primeira atividade.' },
    { nome: 'B', descricao: 'Segunda atividade.' },
    { nome: 'C', descricao: 'Terceira atividade.' },
    { nome: 'D', descricao: 'Quarta atividade.' },
  ];
  const msg = mensagemBuscaResultados(muitos);
  assert.match(msg, /1\. \*A\*/);
  assert.match(msg, /3\. \*C\*/);
  assert.doesNotMatch(msg, /4\. \*D\*/);
});

test('T7: mensagemLembrete e mensagemIncentivo incluem o nome', () => {
  assert.match(mensagemLembrete('Maria', atividade), /Olá, Maria!/);
  assert.match(mensagemLembrete('Maria', atividade), /Lembrete da Amparo/);
  assert.match(mensagemIncentivo('Maria'), /Oi, Maria!/);
  assert.match(mensagemIncentivo(null), /Oi!/);
});