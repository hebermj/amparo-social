/**
 * ── Módulo de Busca Web ─────────────────────────────────────────
 * Pesquisa atividades na internet usando SearXNG (primário) e
 * Bing Search API (fallback).
 *
 * Ordem de tentativa:
 *   1. SearXNG (self-hosted) — SEARXNG_URL + SEARXNG_API_KEY
 *   2. Bing Search API — BING_API_KEY
 *   3. Mensagem amigável se ambos falharem
 */

const SEARXNG_URL = process.env.SEARXNG_URL; // ex: "http://192.168.1.100:4000"
const SEARXNG_API_KEY = process.env.SEARXNG_API_KEY;
const BING_API_KEY = process.env.BING_API_KEY;
const CIDADE_PADRAO = process.env.CIDADE_PADRAO || '';

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
 * Busca via SearXNG (self-hosted).
 * Endpoint: GET /search?q=...&format=json&language=pt-BR
 */
async function buscarSearXNG(termo) {
  if (!SEARXNG_URL) return null;

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

  if (!res.ok) {
    console.warn(`[SEARXNG] HTTP ${res.status}`);
    return null;
  }

  const data = await res.json();
  const results = data.results || [];

  if (results.length === 0) return null;

  return normalizarResultados(results.slice(0, 10), 'searxng');
}

/**
 * Busca via Bing Search API (fallback).
 * Endpoint: GET /v7.0/search
 */
async function buscarBing(termo) {
  if (!BING_API_KEY) return null;

  const url = 'https://api.bing.microsoft.com/v7.0/search';
  const params = new URLSearchParams({
    q: termo,
    count: '10',
    mkt: 'pt-BR',
    safeSearch: 'Strict',
    textFormat: 'Raw',
  });

  const res = await fetch(`${url}?${params}`, {
    headers: {
      'Ocp-Apim-Subscription-Key': BING_API_KEY,
    },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    console.warn(`[BING] HTTP ${res.status}`);
    return null;
  }

  const data = await res.json();
  const results = data.webPages?.value || [];

  if (results.length === 0) return null;

  return normalizarResultados(results, 'bing');
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

  // 1º: SearXNG
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

  // 2º: Bing
  let resultsBing = null;
  try {
    resultsBing = await buscarBing(termo);
  } catch (e) {
    console.warn(`[SEARCH] Bing error: ${e.message}`);
  }
  if (resultsBing) {
    console.log(`[SEARCH] Bing: ${resultsBing.length} resultados`);
    return resultsBing;
  }

  console.log('[SEARCH] Sem resultados de busca');
  return [];
}

module.exports = { buscarAtividades };
