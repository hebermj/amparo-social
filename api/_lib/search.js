/**
 * ── Módulo de Busca Web ─────────────────────────────────────────
 * Pesquisa atividades na internet usando SearXNG (primário e comunitário).
 *
 * Ordem de tentativa:
 *   1. SearXNG self-hosted (configurado via SEARXNG_URL)
 *   2. SearXNG comunitário — instâncias públicas que aceitam format=json
 *   3. Lista vazia (o fluxo segue só com a Base de Atividades)
 */

const CIDADE_PADRAO = process.env.CIDADE_PADRAO || '';

/* Instâncias públicas da SearXNG (instâncias comunitárias, sem chave API).
   A lista default contém apenas instâncias verificadas que respondem
   format=json com resultados (checadas em 2026-08). Pode ser sobrescrita
   via SEARXNG_COMMUNITY_INSTANCES (separadas por vírgula).
 */
const SEARXNG_COMMUNITY_INSTANCES_DEFAULT = [
  'https://search.mectov.my.id',
];

function lerCommunityInstances() {
  const custom = process.env.SEARXNG_COMMUNITY_INSTANCES;
  if (custom) {
    return custom.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return SEARXNG_COMMUNITY_INSTANCES_DEFAULT;
}

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
  const SEARXNG_URL = process.env.SEARXNG_URL;
  const SEARXNG_API_KEY = process.env.SEARXNG_API_KEY;
  const instances = lerCommunityInstances();

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

    try {
      const res = await fetch(`${url}?${params}`, { headers, signal: AbortSignal.timeout(8000) });

      if (res.ok) {
        const data = await res.json();
        const results = data.results || [];

        if (results.length > 0) {
          return normalizarResultados(results.slice(0, 10), 'searxng');
        }
        console.warn(`[SEARXNG-self] HTTP 200 sem resultados (JSON vazio)`);
      } else {
        console.warn(`[SEARXNG-self] HTTP ${res.status}`);
      }
    } catch (e) {
      console.warn(`[SEARXNG-self] error: ${e.message}`);
    }
  } else {
    console.warn('[SEARXNG-self] SEARXNG_URL não configurado — usando instâncias comunitárias');
  }

  // 2º: Tenta instâncias comunitárias
  for (const instance of instances) {
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
        console.warn(`[SEARXNG-community] ${instance} HTTP 200 sem resultados (JSON vazio)`);
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

module.exports = { buscarPorTermo, montarTermoBusca, CIDADE_PADRAO };