const { test } = require('node:test');
const assert = require('node:assert');

const { buildPrompt } = require('../api/_lib/prompt.js');

// Detecta caracteres de emoji (pictográficos) no texto gerado.
const EMOJI = /[\p{Extended_Pictographic}]/u;

const SECOES = [
  'IDENTIDADE',
  'PERSONA',
  'CONTEXTO ATUAL DO USUÁRIO',
  'FERRAMENTAS',
  'EXEMPLOS DE DIÁLOGO',
];

test('T6: buildPrompt tem as 5 seções canônicas', () => {
  const prompt = buildPrompt({});
  for (const secao of SECOES) {
    assert.match(prompt, new RegExp(secao), `seção "${secao}" deve existir`);
  }
});

test('T6: buildPrompt não emite emojis em nenhuma seção', () => {
  const prompt = buildPrompt({
    user: { nome: 'Maria', cidade: 'Santo André', bairro: 'Centro', interesses: ['cultura'] },
  });
  assert.doesNotMatch(prompt, EMOJI, 'o prompt não deve conter emojis');
});

test('T6: buildPrompt não usa "sr." nem "sra."', () => {
  const prompt = buildPrompt({});
  assert.doesNotMatch(prompt, /\bsr\.\b|\bsra\.\b/i, 'não deve haver tratamento por sr./sra.');
});

test('T6: buildPrompt não usa a metáfora familiar "neto/neta"', () => {
  const prompt = buildPrompt({});
  assert.doesNotMatch(prompt, /\bneto\b|\bneta\b/i, 'persona deve ser assistente, não neto/neta');
});

test('T6: seção IA Proativa foi removida do prompt', () => {
  const prompt = buildPrompt({});
  assert.doesNotMatch(prompt, /IA Proativa|Saudades/i, 'IA Proativa é coberta pelo cron, não pelo LLM');
});

test('T6: PERSONA declara os limites do assistente', () => {
  const prompt = buildPrompt({});
  assert.match(prompt, /saúde/i, 'limite: não é profissional de saúde');
  assert.match(prompt, /endereço/i, 'limite: não inventa endereços/atividades');
  assert.match(prompt, /financeir|legal/i, 'limite: não dá conselhos financeiros/legais');
});

test('T6: fluxo de Horário de Lembretes é mantido com exemplo neutro', () => {
  const prompt = buildPrompt({});
  assert.match(prompt, /horário|lembrete/i, 'deve manter o fluxo de horário/lembretes');
  assert.match(
    prompt,
    /Você\s+quer\s+que\s+eu\s+lembre\s+das\s+atividades\?\s+Que\s+horário\s+é\s+melhor\s+para\s+você/i,
    'exemplo neutro de coleta de horário'
  );
});

test('T6: exemplos de diálogo usam primeiro nome (Maria) e nunca "Alex"', () => {
  const prompt = buildPrompt({});
  assert.match(prompt, /Maria/, 'exemplos devem usar o nome Maria');
  assert.doesNotMatch(prompt, /\bAlex\b/, 'exemplos não devem usar "Alex" (LLM repetia para usuário sem perfil)');
  assert.doesNotMatch(prompt, /sra\. Maria|sr\. Maria/i, 'exemplos não devem usar título');
});

test('T6: prompt proíbe inventar o nome do usuário', () => {
  const prompt = buildPrompt({});
  assert.match(prompt, /NUNCA invente|não souber o nome|Como posso chamar você/i,
    'persona deve nunca adivinhar o nome do usuário');
});

test('T6: salvar_perfil é acionado incrementalmente a cada campo', () => {
  const prompt = buildPrompt({});
  assert.match(prompt, /a CADA campo coletado|ao menos um campo/i,
    'salvar_perfil deve ser acionado incrementalmente');
});

test('T6: ferramentas de atividade foram aposentadas do prompt', () => {
  const prompt = buildPrompt({});
  assert.doesNotMatch(prompt, /recomendar_atividades/, 'não deve haver recomendar_atividades');
  assert.doesNotMatch(prompt, /buscar_online/, 'não deve haver buscar_online');
  assert.doesNotMatch(prompt, /\[\[RECOMENDAR/, 'não deve haver marcador RECOMENDAR');
  assert.doesNotMatch(prompt, /\[\[BUSCAR/, 'não deve haver marcador BUSCAR');
});

test('T6: perfil e horário seguem como ferramentas', () => {
  const prompt = buildPrompt({});
  assert.match(prompt, /\[\[PERFIL:/, 'marcador PERFIL deve permanecer');
  assert.match(prompt, /\[\[HORARIO:/, 'marcador HORARIO deve permanecer');
});