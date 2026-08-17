/**
 * ── Orquestrador de Pedido de Atividade ─────────────────────────
 * Um único ponto de entrada para o fluxo "Busca sempre + Curadoria":
 * detecta o Pedido de Atividade por heurística, monta o termo de busca
 * a partir da mensagem + perfil, sempre aciona a Busca Web, mescla com
 * a Base de Atividades (marcando a origem) e entrega uma mensagem final.
 * Proteções de Sessão (T3): cache de resultados por termo (1h) e
 * rate-limit de 10 buscas explícitas/hora.
 * Todas as dependências são injetáveis para teste (seam único), sem
 * rede, banco ou Telegram.
 */

const { recomendarAtividades } = require('./activities');
const { buscarPorTermo, montarTermoBusca, CIDADE_PADRAO } = require('./search');
const { mensagemAtividades, mensagemSemAtividades } = require('./mensagens');
const { curarResultados } = require('./curadoria');

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

// ── Proteções de Sessão (T3) ────────────────────────────────────
const JANELA_BUSCA_MS = 60 * 60 * 1000; // 1h corrida
const MAX_HITS = 10;                    // limite de buscas explícitas/hora
const MAX_CACHE_TERMOS = 3;             // ~3 termos no cache

/**
 * Garante a estrutura session.busca para cache e rate-limit.
 */
function garantirBusca(session) {
  session.busca = session.busca || { cache: {}, hits: [] };
  return session.busca;
}

/**
 * Normaliza um termo de busca para chave de cache (caixa + acentos).
 */
function normalizarTermo(termo) {
  return String(termo || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/**
 * Lê o cache de resultados do termo. Retorna os resultados guardados
 * (Resultados da Busca, sem origem) ou null se ausente/expirado.
 */
function obterDoCache(session, termoNormalizado, agora) {
  const entrada = garantirBusca(session).cache[termoNormalizado];
  if (!entrada) return null;
  if (agora - entrada.ts > JANELA_BUSCA_MS) return null;
  return entrada.resultados;
}

/**
 * Guarda os resultados no cache, expulsando entradas com mais de 60
 * min corridos e mantendo no máximo MAX_CACHE_TERMOS termos.
 */
function guardarNoCache(session, termoNormalizado, resultados, agora) {
  const cache = garantirBusca(session).cache;

  for (const chave of Object.keys(cache)) {
    if (agora - cache[chave].ts > JANELA_BUSCA_MS) {
      delete cache[chave];
    }
  }

  cache[termoNormalizado] = { ts: agora, resultados };

  const chaves = Object.keys(cache);
  if (chaves.length > MAX_CACHE_TERMOS) {
    const maisNovas = chaves
      .sort((a, b) => cache[b].ts - cache[a].ts)
      .slice(0, MAX_CACHE_TERMOS);
    for (const chave of chaves) {
      if (!maisNovas.includes(chave)) delete cache[chave];
    }
  }
}

/**
 * Hits de busca explícita dentro da janela de 1h corrida.
 */
function hitsNaJanela(session, agora) {
  return garantirBusca(session).hits.filter((ts) => agora - ts <= JANELA_BUSCA_MS);
}

/**
 * Registra uma busca explícita do Usuário no rate-limit, expurgando
 * hits com mais de 60 min e mantendo os MAX_HITS mais recentes.
 */
function registrarHit(session, agora) {
  const hits = hitsNaJanela(session, agora);
  hits.push(agora);
  garantirBusca(session).hits = hits.slice(-MAX_HITS);
}

/**
 * True quando o Usuário já atingiu o limite de buscas na janela de 1h.
 */
function noLimite(session, agora) {
  return hitsNaJanela(session, agora).length >= MAX_HITS;
}

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
 * Registra o turno no histórico da Sessão.
 */
function registrarNoHistorico(session, texto, resposta) {
  session.history = session.history || [];
  session.history.push({ role: 'user', content: texto });
  session.history.push({ role: 'assistant', content: resposta });
  if (session.history.length > 12) {
    session.history = session.history.slice(-12);
  }
}

/**
 * Origem dominante dos itens: 'base' se há ao menos um item da Base.
 */
function origemDosItens(itens) {
  return itens.some((i) => i.origem === 'base') ? 'base' : 'web';
}

/**
 * Monta os itens da Base de Atividades (ampliando bairros quando o
 * bairro do Usuário não atende), marcando a origem.
 */
function recomendarDaBase(recomendarBase, cidade, bairro, interesses) {
  let daBase = recomendarBase(cidade, bairro, interesses);
  if (daBase.length === 0 && bairro) {
    daBase = recomendarBase(cidade, undefined, interesses);
  }
  return daBase.map((a) => ({ ...a, origem: 'base' }));
}

/**
 * Processa um Pedido de Atividade de ponta a ponta.
 *
 * @param {string} texto — mensagem do Usuário (ou '/atividades')
 * @param {object} session — sessão persistida (histórico, perfil e proteções)
 * @param {object} [deps] — dependências injetáveis para teste
 * @param {Function} [deps.detectarPedido] — heurística de detecção
 * @param {Function} [deps.montarTermo] — construtor do termo de busca
 * @param {Function} [deps.recomendarBase] — recomenda da Base local
 * @param {Function} [deps.buscarWeb] — busca na web (SearXNG)
 * @param {Function} [deps.curar] — curadoria pela IA (default: curarResultados)
 * @param {Function} [deps.agora] — relógio injetável (default: Date.now)
 * @returns {Promise<string|null>} — mensagem final, ou null se não for
 *   um Pedido de Atividade
 */
async function processarPedidoDeAtividades(texto, session, deps = {}) {
  const detectarPedido = deps.detectarPedido || parecePedidoDeAtividades;
  const montarTermo = deps.montarTermo || montarTermoPadrao;
  const recomendarBase = deps.recomendarBase || recomendarAtividades;
  const buscarWeb = deps.buscarWeb || ((termo) => buscarPorTermo(termo));
  const curar = deps.curar || curarResultados;
  const agora = deps.agora || (() => Date.now());

  if (!detectarPedido(texto)) return null;

  session.busca = session.busca || { cache: {}, hits: [] };
  const agoraTs = agora();

  const cidade = session.user?.cidade || CIDADE_PADRAO;
  const bairro = session.user?.bairro;
  const interesses = session.user?.interesses || [];

  const termo = montarTermo(texto, session);
  const termoNormalizado = normalizarTermo(termo);

  // 0. Cache-hit → template direto, sem busca web e sem curadoria,
  //    e sem registrar hit no rate-limit. A Base é re-recomendada
  //    fresca e mesclada com os Resultados da Busca cacheados.
  const resultadosCache = obterDoCache(session, termoNormalizado, agoraTs);
  if (resultadosCache !== null) {
    const daBaseCache = recomendarDaBase(recomendarBase, cidade, bairro, interesses);
    const itensCache = [
      ...daBaseCache,
      ...resultadosCache.slice(0, 5).map((r) => ({ ...r, origem: 'web' })),
    ];
    const resposta = itensCache.length === 0
      ? mensagemSemAtividades()
      : mensagemAtividades(itensCache, origemDosItens(itensCache));
    registrarNoHistorico(session, texto, resposta);
    return resposta;
  }

  // 1. Base de Atividades (amplia bairros quando necessário).
  const daBase = recomendarDaBase(recomendarBase, cidade, bairro, interesses);

  let daWeb = [];
  if (noLimite(session, agoraTs)) {
    // Estouro do rate-limit → cai para a Base curada (curadoria só
    // com a Base; sem Busca Web).
    console.warn('[ORQUESTRADOR] Rate-limit atingido; usando só a Base.');
  } else {
    // 2. Busca Web SEMPRE (sem limiar de fallback) — só quando há folga.
    try {
      daWeb = (await buscarWeb(termo, cidade)) || [];
    } catch (err) {
      console.error('[ORQUESTRADOR] Busca web falhou:', err.message);
      daWeb = [];
    }
    // Conta como busca explícita do Usuário (só quando de fato buscou)
    // e guarda os Resultados da Busca no cache (chave = termo).
    registrarHit(session, agoraTs);
    guardarNoCache(session, termoNormalizado, daWeb, agoraTs);
  }

  const itens = [
    ...daBase,
    ...daWeb.slice(0, 5).map((r) => ({ ...r, origem: 'web' })),
  ];

  const origem = origemDosItens(itens);

  let resposta;
  if (itens.length === 0) {
    resposta = mensagemSemAtividades();
  } else {
    try {
      resposta = await curar(itens, session);
    } catch (err) {
      console.error('[ORQUESTRADOR] Curadoria falhou:', err.message);
      resposta = null;
    }
    // Curadoria falhou/saída inválida → template tolerante do T1
    if (!resposta || resposta.trim() === '') {
      resposta = mensagemAtividades(itens, origem);
    }
  }

  registrarNoHistorico(session, texto, resposta);

  return resposta;
}

module.exports = {
  processarPedidoDeAtividades,
  parecePedidoDeAtividades,
  montarTermoPadrao,
  normalizarTermo,
  obterDoCache,
  guardarNoCache,
  registrarHit,
  noLimite,
};