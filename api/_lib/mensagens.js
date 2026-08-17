/**
 * ── Mensagens do Amparo ─────────────────────────────────────────
 * Construtores puros de mensagens exibidas ao usuário no Telegram.
 * Testáveis sem rede, banco ou Telegram — o webhook só envia o texto.
 * Regras de persona: tratamento por primeiro nome e zero emojis.
 */

const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];

/**
 * Formata uma data_hora (ex.: "2026-07-06T14:00:00") como
 * "segunda, 06/07 às 14h".
 */
function formatarDataHora(dataHora) {
  const data = new Date(dataHora);
  const diaSem = DIAS_SEMANA[data.getDay()];
  const diaMes = data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  return `${diaSem}, ${diaMes} às ${data.getHours()}h`;
}

function mensagemStart() {
  return (
    'Olá! Sou o **Amparo**, seu assistente de bem-estar digital.\n\n' +
    'Vou ajudar você a encontrar atividades sociais, culturais e de lazer perto da sua casa.\n\n' +
    'Para começar, qual é o seu nome?'
  );
}

function mensagemSemChaveIA() {
  return (
    'Olá! Para eu funcionar, preciso de uma chave de IA configurada.\n\n' +
    'Peça ao desenvolvedor para definir OPENCODE_ZEN_API_KEY ou OPENROUTER_API_KEY.'
  );
}

function mensagemSemAtividades() {
  return 'Não encontrei atividades para essa região agora. Tente me pedir outro tipo de atividade!';
}

/**
 * Lista de atividades recomendadas (até 5), numerada, tolerante a ambos
 * os formatos: itens da Base (`endereco`/`data_hora`) e Resultados da
 * Busca (`descricao`/`fonte`). Nunca expõe URLs cruas (link/url) — a
 * fonte aparece apenas como rótulo amigável.
 * @param {object[]} atividades — atividades com nome + endereco/data_hora e/ou descricao/fonte
 * @param {'base'|'web'} origem
 * @returns {string}
 */
function mensagemAtividades(atividades, origem) {
  const abertura = origem === 'web'
    ? 'Encontrei atividades na internet para você!\n\n'
    : 'Aqui estão as atividades que encontrei:\n\n';

  let resp = abertura;
  atividades.slice(0, 5).forEach((a, i) => {
    resp += `${i + 1}. *${a.nome}*\n`;
    if (a.endereco) resp += `   Endereço: ${a.endereco}\n`;
    if (a.data_hora) resp += `   Quando: ${formatarDataHora(a.data_hora)}\n`;
    if (a.descricao) {
      const frase = a.descricao.split(/[.!?]/)[0].substring(0, 120);
      resp += `   ${frase}.\n`;
    }
    if (a.fonte) resp += `   Fonte: ${a.fonte}\n`;
    resp += '\n';
  });
  resp += '_Qual te interessou? Me fala!_';
  return resp;
}

/**
 * Lembrete proativo de uma atividade futura.
 * @param {string} nome — primeiro nome do usuário
 * @param {object} proxima — atividade com nome, data_hora e endereco
 * @returns {string}
 */
function mensagemLembrete(nome, proxima) {
  return (
    `Olá, ${nome}! Lembrete da Amparo:\n\n` +
    `*${proxima.nome}* está chegando!\n` +
    `Quando: ${formatarDataHora(proxima.data_hora)}\n` +
    (proxima.endereco ? `Onde: ${proxima.endereco}\n` : '') +
    '\nQuer saber mais? É só me chamar!'
  );
}

/**
 * Incentivo de IA Proativa para usuários inativos.
 * @param {string} [nome] — primeiro nome do usuário (opcional)
 * @returns {string}
 */
function mensagemIncentivo(nome) {
  const abertura = nome ? `Oi, ${nome}!` : 'Oi!';
  return (
    `${abertura} Faz uns dias que não conversamos.\n\n` +
    'Quer que eu te mostre atividades legais perto de você para essa semana? ' +
    'É só me chamar! Estou aqui sempre que precisar.'
  );
}

module.exports = {
  mensagemStart,
  mensagemSemChaveIA,
  mensagemSemAtividades,
  mensagemAtividades,
  mensagemLembrete,
  mensagemIncentivo,
};