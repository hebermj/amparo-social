/**
 * ── Módulo de Busca Web ─────────────────────────────────────────
 * Pesquisa atividades na internet consultando EXCLUSIVAMENTE a
 * Instância SearXNG Própria (configurada via SEARXNG_URL), autenticada
 * por credencial básica (SEARXNG_USER/SEARXNG_PASSWORD).
 *
 * Não há fallback para instâncias comunitárias (ADR-0006): se a Instância
 * falhar ou não houver SEARXNG_URL, retorna lista vazia — o fluxo segue
 * só com a Base de Atividades.
 */

const CIDADE_PADRAO = process.env.CIDADE_PADRAO || '';

// Scripts não-latinos (chinês, japonês, coreano, cirílico, etc.) cujos
// Resultados são descartados como defesa em profundidade: o público do
// Amparo fala português e a Instância pode devolver algo em outro idioma.
const NAO_LATINO_RE = /[\u0370-\u1FFF\u2E80-\u9FFF\uAC00-\uD7AF\u3040-\u30FF\uF900-\uFAFF\uFE30-\uFE4F]/;

/**
 * Texto combinado de um Resultado (conteúdo ou trecho), para título+descrição.
 */
function textoDe(item) {
  return item.content || item.snippet || '';
}

/**
 * Normaliza os Resultados da Instância para o formato único, descartando
 * os que contenham scripts não-latinos no título ou na descrição.
 */
function normalizarResultados(items, fonte) {
  return items
    .filter((item) => {
      const titulo = item.title || '';
      return !NAO_LATINO_RE.test(`${titulo} ${textoDe(item)}`);
    })
    .map((item) => {
      const desc = textoDe(item);
      // Remove trechos de navegação (breadcrumbs, etc)
      const descLimpa = desc
        .replace(/^.*?›\s*/g, '')
        .replace(/\s*\d+\s*(min|h)\s*(atrás|ago).*$/i, '')
        .trim();

      return {
        nome: item.title?.replace(/ [|] .*$/, '').trim() || 'Atividade',
        descricao: descLimpa.substring(0, 200),
        link: item.url || '',
        fonte,
      };
    });
}

/**
 * Busca na Instância SearXNG Própria.
 * Endpoint: GET /search?q=...&format=json&language=pt-BR
 * @returns {Promise<object[]|null>} — Resultados normalizados, ou null
 * quando a Instância está indisponível/não configurada.
 */
async function buscarSearXNG(termo) {
  const SEARXNG_URL = process.env.SEARXNG_URL;
  const user = process.env.SEARXNG_USER;
  const senha = process.env.SEARXNG_PASSWORD;

  if (!SEARXNG_URL) {
    console.warn('[SEARXNG] SEARXNG_URL não configurado — a Busca Web fica indisponível (Base de Atividades apenas)');
    return null;
  }

  const url = `${SEARXNG_URL.replace(/\/$/, '')}/search`;
  const params = new URLSearchParams({
    q: termo,
    format: 'json',
    language: 'pt-BR',
    locale: 'pt-BR',
    safesearch: '1',
  });

  const headers = { 'Accept': 'application/json' };
  if (user && senha) {
    headers['Authorization'] = `Basic ${Buffer.from(`${user}:${senha}`).toString('base64')}`;
  }

  try {
    const res = await fetch(`${url}?${params}`, { headers, signal: AbortSignal.timeout(8000) });

    if (res.ok) {
      const data = await res.json();
      const results = data.results || [];

      if (results.length > 0) {
        // Filtra scripts não-latinos ANTES de limitar a 10: se os primeiros
        // resultados crus fossem descartados depois, perderíamos os válidos.
        return normalizarResultados(results, 'searxng').slice(0, 10);
      }
      console.warn('[SEARXNG] HTTP 200 sem resultados (JSON vazio)');
    } else {
      console.warn(`[SEARXNG] HTTP ${res.status}`);
    }
  } catch (e) {
    console.warn(`[SEARXNG] error: ${e.message}`);
  }

  return null;
}

/**
 * Monta o termo de busca adicionando contexto de cidade e público,
 * sem duplicar palavras que já estão no termo original.
 * O termo específico da mensagem (ex.: "cerâmica") é mesclado com os
 * interesses do perfil; quando a mensagem não traz termo específico,
 * usa apenas os interesses do perfil.
 */
function montarTermoBusca(mensagem, interesses = [], cidade = CIDADE_PADRAO) {
  const especifico = extrairTermoDaMensagem(mensagem);
  let base = [especifico, ...interesses].filter(Boolean).join(' ').trim();
  if (cidade && !base.toLowerCase().includes(cidade.toLowerCase())) {
    base += ` ${cidade}`;
  }
  if (!base.toLowerCase().includes('idoso') && !base.toLowerCase().includes('terceira idade')) {
    base += ' idosos';
  }
  if (!base.toLowerCase().includes('atividad')) {
    base += ' atividades';
  }
  return base.trim();
}

// Palavras genéricas de um pedido de atividade, removidas ao extrair o
// termo específico (ex.: de "tem aula de cerâmica?" sobra "cerâmica").
const PALAVRAS_GENERICAS = new Set([
  'o', 'que', 'tem', 'ter', 'para', 'pra', 'de', 'da', 'do', 'na', 'no',
  'alguma', 'algum', 'sugere', 'sugira', 'recomenda', 'recomende',
  'atividade', 'atividades', 'evento', 'eventos', 'aula', 'aulas', 'curso',
  'cursos', 'oficina', 'oficinas', 'vai', 'quero', 'gostaria',
  'encontrar', 'procurar', 'hoje', 'essa', 'este', 'esta', 'região', 'bairro',
  'fazer', 'saber', 'ver', 'como', 'pode', 'poderia', 'me', 'por', 'em',
  // Refinamentos de recomendação (ex.: "algo mais perto de pinheiros?")
  'isso', 'nao', 'não', 'casa', 'mais', 'perto', 'proximo', 'próximo',
  'proxima', 'próxima', 'longe', 'outra', 'outro', 'opcao', 'opção', 'algo',
  'e', 'é', 'na', 'no', 'pra', 'pro',
]);

/**
 * Extrai o termo específico de um pedido de atividade.
 * Ex.: "tem aula de cerâmica?" → "cerâmica". Retorna '' quando não há.
 */
function extrairTermoDaMensagem(mensagem) {
  const palavras = String(mensagem || '')
    .toLowerCase()
    .split(/[^a-z0-9à-úçãõâêîôû]+/)
    .filter((p) => p && !PALAVRAS_GENERICAS.has(p));
  return palavras.join(' ');
}

/**
 * Busca atividades na web por termo já montado.
 *
 * @param {string} termo — termo de busca completo (ex.: "cerâmica Santo André idosos atividades")
 * @returns {Promise<object[]>} — Array de resultados normalizados
 */
async function buscarPorTermo(termo) {
  console.log(`[SEARCH] Buscando: "${termo}"`);

  // 1º: Instância SearXNG Própria (única provedora — ADR-0006)
  let resultsSearXNG = null;
  try {
    resultsSearXNG = await buscarSearXNG(termo);
  } catch (e) {
    console.warn(`[SEARCH] SearXNG error: ${e.message}`);
  }
  if (resultsSearXNG) {
    console.log(`[SEARCH] SearXNG: ${resultsSearXNG.length} resultados`);
    return resultsSearXNG;
  }

  // 2º: Sem fallback — retorna vazio se a Instância falhar; o fluxo
  // segue só com a Base de Atividades.
  console.log('[SEARCH] Sem resultados de busca (Instância SearXNG indisponível)');
  return [];
}

module.exports = { buscarPorTermo, montarTermoBusca, CIDADE_PADRAO };