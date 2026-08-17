/**
 * ── Curadoria da IA ─────────────────────────────────────────────
 * Única chamada LLM do caminho de Pedido de Atividade (além do chat
 * livre). Recebe a fusão Base de Atividades + top 5 Resultados da
 * Busca (com campo `origem`), é instruída a preferir a Base quando
 * relevante, e escreve a mensagem final. A saída é validada: se a
 * chamada falhar, vier vazia, contiver URL crua, emojis, mais de 2
 * parágrafos ou não apresentar nenhuma atividade, retorna null — o
 * orquestrador cai no template tolerante.
 */

const { completarComLLM } = require('./llm');

// Validações: os mesmos invariantes são pedidos à LLM no prompt abaixo.
// Mantenha os dois em sincronia.
const EMOJI_RE = /[\p{Extended_Pictographic}]/u;
const URL_RE = /(?:https?:\/\/|www\.)\S+/i;

/**
 * Serializa a fusão Base + web para o prompt da curadoria.
 * NOTA: o campo `link` dos Resultados da Busca é deliberadamente
 * omitido — a URL crua nunca chega à LLM, então não pode vazar.
 */
function serializarItens(itens) {
  return itens
    .map((item, i) => {
      const base = [
        `${i + 1}. ${item.nome}`,
        `origem: ${item.origem}`,
      ];
      if (item.descricao) base.push(`descrição: ${item.descricao}`);
      if (item.endereco) base.push(`endereço: ${item.endereco}`);
      if (item.data_hora) base.push(`quando: ${item.data_hora}`);
      if (item.fonte) base.push(`fonte: ${item.fonte}`);
      return base.join(' | ');
    })
    .join('\n');
}

/**
 * Monta o prompt da curadoria com o perfil do usuário para contexto.
 */
function montarPromptCuradoria(itens, session) {
  const user = session.user || {};
  const interesses = (user.interesses || []).join(', ');
  const cidade = user.cidade || '';
  const bairro = user.bairro || '';

  return [
    'Você é o Amparo, assistente de bem-estar digital para pessoas idosas.',
    'Abaixo está uma lista de atividades candidatas: da Base de Atividades (origem: base)',
    'e de uma busca na web (origem: web).',
    '',
    `Usuário: ${user.nome || '—'} (${cidade}${bairro ? `, bairro ${bairro}` : ''})`,
    `Interesses: ${interesses || '—'}`,
    '',
    'Escreva UMA resposta final para o usuário, em linguagem simples e amigável,',
    'apresentando as atividades mais relevantes para ele.',
    '',
    'REGRAS OBRIGATÓRIAS:',
    '- Prefira itens de origem: base quando forem relevantes para os interesses.',
    '- Apresente no máximo 5 atividades, em lista numerada com nome e quando/endereço.',
    '- No máximo 2 parágrafos curtos.',
    '- ZERO emojis.',
    '- NUNCA inclua URLs ou links na resposta.',
    '- Se apresentar um item de origem: web, diga a fonte entre parênteses ao final do item',
    '  (ex.: "(fonte: searxng)").',
    '',
    'CANDIDATAS:',
    serializarItens(itens),
    '',
    'Resposta:',
  ].join('\n');
}

/**
 * Normaliza texto para comparação tolerante a maiúsculas e acentos.
 */
function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Valida a resposta da curadoria. Retorna true apenas se a resposta
 * puder ser exibida com segurança: não vazia, sem URL crua, sem
 * emojis, com no máximo 2 parágrafos, com rótulo de fonte quando
 * apresenta um item da web, e referenciando ao menos uma das
 * candidatas (ou seja, apresentando alguma atividade).
 */
function validarCuradoria(resposta, itens) {
  if (!resposta || resposta.trim() === '') return false;
  if (URL_RE.test(resposta)) return false;
  if (EMOJI_RE.test(resposta)) return false;

  const paragrafos = resposta.split(/\n\s*\n/).filter((p) => p.trim() !== '');
  if (paragrafos.length > 2) return false;

  const respostaNorm = normalizar(resposta);
  const nomes = itens.map((i) => normalizar(i.nome)).filter(Boolean);
  const apresentaAlgum = nomes.some((nome) => respostaNorm.includes(nome));
  if (!apresentaAlgum) return false;

  const apresentaWeb = itens.some(
    (i) => i.origem === 'web' && respostaNorm.includes(normalizar(i.nome))
  );
  if (apresentaWeb && !/fonte\s*:/i.test(resposta)) return false;

  return true;
}

/**
 * Curadoria da IA: chama a LLM (via gateway reutilizado) para
 * transformar a fusão em resposta final. Retorna null quando a saída
 * não passa na validação (o orquestrador usa o template nesse caso).
 *
 * @param {object[]} itens — fusão Base + web, cada item com `origem`
 * @param {object} session — sessão (perfil para contexto)
 * @param {object} [deps] — deps injetáveis para teste
 * @param {Function} [deps.completar] — substituto de completarComLLM
 * @returns {Promise<string|null>}
 */
async function curarResultados(itens, session, deps = {}) {
  const completar = deps.completar || completarComLLM;
  const prompt = montarPromptCuradoria(itens, session);
  let resposta = null;
  try {
    resposta = await completar(prompt, []);
  } catch (err) {
    console.error('[CURADORIA] Falha técnica:', err.message);
    return null;
  }
  if (!validarCuradoria(resposta, itens)) {
    return null;
  }
  return resposta;
}

module.exports = { curarResultados, montarPromptCuradoria, validarCuradoria };