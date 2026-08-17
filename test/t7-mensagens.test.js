const { test } = require('node:test');
const assert = require('node:assert');

const {
  mensagemStart,
  mensagemSemChaveIA,
  mensagemSemAtividades,
  mensagemAtividades,
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

test('T7: mensagemAtividades tolera Resultados da Busca (descricao/fonte, sem URL crua)', () => {
  const web = [
    {
      nome: 'Ateliê de Cerâmica',
      descricao: 'Aulas de cerâmica para iniciantes na região central.',
      fonte: 'searxng',
      link: 'https://exemplo.com/atelie',
    },
  ];
  const msg = mensagemAtividades(web, 'web');
  assert.match(msg, /1\. \*Ateliê de Cerâmica\*/);
  assert.match(msg, /Aulas de cerâmica para iniciantes/);
  assert.match(msg, /Fonte: searxng/);
  assert.doesNotMatch(msg, /exemplo\.com/, 'nunca expor URL crua');
});

test('T7: mensagemAtividades limita a 5 atividades', () => {
  const muitos = [
    { nome: 'A', endereco: 'Rua X, 1', data_hora: '2026-08-20T14:00:00' },
    { nome: 'B', endereco: 'Rua X, 2', data_hora: '2026-08-20T15:00:00' },
    { nome: 'C', endereco: 'Rua X, 3', data_hora: '2026-08-20T16:00:00' },
    { nome: 'D', endereco: 'Rua X, 4', data_hora: '2026-08-20T17:00:00' },
    { nome: 'E', endereco: 'Rua X, 5', data_hora: '2026-08-20T18:00:00' },
    { nome: 'F', endereco: 'Rua X, 6', data_hora: '2026-08-20T19:00:00' },
  ];
  const msg = mensagemAtividades(muitos, 'base');
  assert.match(msg, /1\. \*A\*/);
  assert.match(msg, /5\. \*E\*/);
  assert.doesNotMatch(msg, /6\. \*F\*/);
});

test('T7: mensagemLembrete e mensagemIncentivo incluem o nome', () => {
  assert.match(mensagemLembrete('Maria', atividade), /Olá, Maria!/);
  assert.match(mensagemLembrete('Maria', atividade), /Lembrete da Amparo/);
  assert.match(mensagemIncentivo('Maria'), /Oi, Maria!/);
  assert.match(mensagemIncentivo(null), /Oi!/);
});