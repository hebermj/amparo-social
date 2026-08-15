/**
 * ── Módulo de Busca Web ─────────────────────────────────────────
 * Pesquisa atividades na internet usando SearXNG (primário e comunitário).
 *
 * Ordem de tentativa:
 *   1. SearXNG self-hosted (configurado via SEARXNG_URL)
 *   2. SearXNG comunitário — instâncias públicas de searx.space
 *   3. Mensagem amigável se todos falharem
 */

const SEARXNG_URL = process.env.SEARXNG_URL; // ex: "http://192.168.1.100:4000"
const SEARXNG_API_KEY = process.env.SEARXNG_API_KEY;
const CIDADE_PADRAO = process.env.CIDADE_PADRAO || '';

/* Instâncias públicas da SearXNG (instâncias comunitárias, sem chave API necessária).
   Mais instâncias são tentadas se a primeira falhar.
 */
const SEARXNG_COMMUNITY_INSTANCES = [
  'https://searx.space',
  'https://searxng.org',
  'https://search.privacytools.info',
  'https://searx.be',
];

/**
 * Normaliza os resultados dos diferentes provedores para um formato único.
 */
function normalizarResultados(items, fonte) {
  return items.map((item) => {
    const desc = item.content || item.snippet || '';
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
 * Busca via SearXNG (self-hosted ou comunidade).
 * Tenta primeiro a URL configurada, depois instâncias públicas.
 * Endpoint: GET /search?q=...&format=json&language=pt-BR
 */
async function buscarSearXNG(termo) {
  // 1º: Tenta a URL self-hosted configurada
  if (SEARXNG_URL) {
    const url = `${SEARXNG_URL.replace(/\/$/, '')}/search`;
    const params = new URLSearchParams({
      q: termo,
      format: 'json',
      language: 'pt-BR',
      safesearch: '1',
    });

    const headers = { 'Accept': 'application/json' };
    if (SEARXNG_API_KEY) {
      headers['Authorization'] = `Bearer ${SEARXNG_API_KEY}`;
    }

    const res = await fetch(`${url}?${params}`, { headers, signal: AbortSignal.timeout(8000) });

    if (res.ok) {
      const data = await res.json();
      const results = data.results || [];

      if (results.length > 0) {
        return normalizarResultados(results.slice(0, 10), 'searxng');
      }
    } else {
      console.warn(`[SEARXNG-self] HTTP ${res.status}`);
    }
  }

  // 2º: Tenta instâncias comunitárias
  for (const instance of SEARXNG_COMMUNITY_INSTANCES) {
    try {
      const url = `${instance.replace(/\/$/, '')}/search`;
      const params = new URLSearchParams({
        q: termo,
        format: 'json',
        language: 'pt-BR',
        safesearch: '1',
      });

      const res = await fetch(`${url}?${params}`, {
        signal: AbortSignal.timeout(8000),
      });

      if (res.ok) {
        const data = await res.json();
        const results = data.results || [];

        if (results.length > 0) {
          console.log(`[SEARXNG-community] ${instance} retornou ${results.length} resultados`);
          return normalizarResultados(results.slice(0, 10), 'searxng-community');
        }
      } else {
        console.warn(`[SEARXNG-community] ${instance} HTTP ${res.status}`);
      }
    } catch (e) {
      console.warn(`[SEARXNG-community] ${instance} error: ${e.message}`);
    }
  }

  return null;
}

/**
 * Monta o termo de busca adicionando contexto de cidade e público,
 * sem duplicar palavras que já estão no termo original.
 */
function montarTermoBusca(interesses, cidade = CIDADE_PADRAO) {
  let base = interesses.join(' ').trim();
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

/**
 * Interface principal: busca atividades na web.
 *
 * @param {string[]} interesses — Lista de interesses (ex: ["pintura", "arte"])
 * @param {string} [cidade] — Cidade para filtrar (default: CIDADE_PADRAO)
 * @returns {Promise<object[]>} — Array de resultados normalizados
 */
async function buscarAtividades(interesses, cidade = CIDADE_PADRAO) {
  const termo = montarTermoBusca(interesses, cidade);
  console.log(`[SEARCH] Buscando: "${termo}"`);

  // 1º: SearXNG (self-hosted ou comunidade)
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

  // 2º: Sem fallback Bing — retorna vazio se SearXNG falhar
  console.log('[SEARCH] Sem resultados de busca (SearXNG indisponível)');
  return [];
}

module.exports = { buscarAtividades };