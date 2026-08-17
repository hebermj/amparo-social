/**
 * ── Orquestrador de Pedido de Atividade ─────────────────────────
 * Um único ponto de entrada para o fluxo "Busca sempre + Curadoria":
 * detecta o Pedido de Atividade por heurística, monta o termo de busca
 * a partir da mensagem + perfil, sempre aciona a Busca Web, mescla com
 * a Base de Atividades (marcando a origem) e entrega uma mensagem final.
 * Todas as dependências são injetáveis para teste (seam único), sem
 * rede, banco ou Telegram.
 */

const { recomendarAtividades } = require('./activities');
const { buscarPorTermo, montarTermoBusca, CIDADE_PADRAO } = require('./search');
const { mensagemAtividades, mensagemSemAtividades } = require('./mensagens');

const PALAVRAS_DE_ATIVIDADE = [
  'atividade', 'atividades', 'evento', 'eventos', 'oficina', 'passeio',
  'curso', 'aula', 'programação', 'programacao', 'bingo', 'música',
  'musica', 'clube', 'grupo', 'teatro', 'museu', 'feira', 'caminhada',
  'passear', 'festa', 'exposição', 'exposicao', 'oficinas',
];

const FRASES_DE_ATIVIDADE = [
  'o que tem', 'o que fazer', 'o que ha', 'vai ter', 'tem alguma',
  'onde tem', 'sugere', 'recomenda', 'recomendam',
  'pode me sugerir', 'o que podemos fazer', 'o que temos',
];

/**
 * Heurística: decide se a mensagem é um Pedido de Atividade.
 * Nunca depende da LLM — é o que garante a resiliência quando a IA
 * de chat falha (rate-limit).
 */
function parecePedidoDeAtividades(texto) {
  const t = String(texto || '').toLowerCase();
  if (t === '/atividades') return true;
  if (FRASES_DE_ATIVIDADE.some((f) => t.includes(f))) return true;
  return PALAVRAS_DE_ATIVIDADE.some((p) => t.includes(p));
}

/**
 * Termo de busca padrão: mescla o termo específico do pedido com os
 * interesses do perfil, a cidade (ou CIDADE_PADRAO) e o público idoso.
 */
function montarTermoPadrao(texto, session) {
  const interesses = session.user?.interesses || [];
  const cidade = session.user?.cidade || CIDADE_PADRAO;
  return montarTermoBusca(texto, interesses, cidade);
}

/**
 * Processa um Pedido de Atividade de ponta a ponta.
 *
 * @param {string} texto — mensagem do Usuário (ou '/atividades')
 * @param {object} session — sessão persistida (histórico e perfil)
 * @param {object} [deps] — dependências injetáveis para teste
 * @param {Function} [deps.detectarPedido] — heurística de detecção
 * @param {Function} [deps.montarTermo] — construtor do termo de busca
 * @param {Function} [deps.recomendarBase] — recomenda da Base local
 * @param {Function} [deps.buscarWeb] — busca na web (SearXNG)
 * @param {Function} [deps.curar] — curadoria pela IA (T2)
 * @returns {Promise<string|null>} — mensagem final, ou null se não for
 *   um Pedido de Atividade
 */
async function processarPedidoDeAtividades(texto, session, deps = {}) {
  const detectarPedido = deps.detectarPedido || parecePedidoDeAtividades;
  const montarTermo = deps.montarTermo || montarTermoPadrao;
  const recomendarBase = deps.recomendarBase || recomendarAtividades;
  const buscarWeb = deps.buscarWeb || ((termo) => buscarPorTermo(termo));
  const curar = deps.curar || null;

  if (!detectarPedido(texto)) return null;

  const cidade = session.user?.cidade || CIDADE_PADRAO;
  const bairro = session.user?.bairro;
  const interesses = session.user?.interesses || [];

  // 1. Base de Atividades; amplia para outros Bairros quando o bairro
  //    do usuário não atende o pedido.
  let daBase = recomendarBase(cidade, bairro, interesses);
  if (daBase.length === 0 && bairro) {
    daBase = recomendarBase(cidade, undefined, interesses);
  }

  // 2. Busca Web SEMPRE (sem limiar de fallback).
  const termo = montarTermo(texto, session);
  let daWeb = [];
  try {
    daWeb = (await buscarWeb(termo, cidade)) || [];
  } catch (err) {
    console.error('[ORQUESTRADOR] Busca web falhou:', err.message);
    daWeb = [];
  }

  const itens = [
    ...daBase.map((a) => ({ ...a, origem: 'base' })),
    ...daWeb.slice(0, 5).map((r) => ({ ...r, origem: 'web' })),
  ];

  const origem = itens.some((i) => i.origem === 'base') ? 'base' : 'web';

  let resposta;
  if (itens.length === 0) {
    resposta = mensagemSemAtividades();
  } else if (curar) {
    resposta = await curar(itens, session);
    if (!resposta || resposta.trim() === '') {
      resposta = mensagemAtividades(itens, origem);
    }
  } else {
    resposta = mensagemAtividades(itens, origem);
  }

  session.history = session.history || [];
  session.history.push({ role: 'user', content: texto });
  session.history.push({ role: 'assistant', content: resposta });
  if (session.history.length > 12) {
    session.history = session.history.slice(-12);
  }

  return resposta;
}

module.exports = {
  processarPedidoDeAtividades,
  parecePedidoDeAtividades,
  montarTermoPadrao,
};