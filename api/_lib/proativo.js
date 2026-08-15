/**
 * ── Lógica Proativa ─────────────────────────────────────────────
 * Funções puras que decidem quem deve receber Lembretes Proativos
 * (RF-014) e mensagens de IA Proativa por inatividade (RF-018).
 * Testáveis sem rede, banco ou Telegram.
 */

const HORARIO_PADRAO = '09:00';

// Brasil não adota horário de verão desde 2019; offset fixo UTC-3.
const FUSO_BRASILIA_HORAS = -3;

/**
 * Converte um instante (Date) para a hora local de Brasília (UTC-3),
 * independente do fuso em que o servidor roda. A Vercel roda em UTC,
 * mas o horário preferido é informado pelo usuário no fuso dele.
 *
 * @param {Date} agora
 * @param {number} [fusoHoras] — offset em horas (default: Brasília)
 * @returns {{hh: string, mm: string}}
 */
function horaLocal(agora, fusoHoras = FUSO_BRASILIA_HORAS) {
  const utcMs = agora.getTime() + agora.getTimezoneOffset() * 60000;
  const local = new Date(utcMs + fusoHoras * 3600000);
  return {
    hh: String(local.getHours()).padStart(2, '0'),
    mm: String(local.getMinutes()).padStart(2, '0'),
  };
}

/**
 * Normaliza "9:00" → "09:00" e "9:5" → "09:05" para comparação.
 */
function normalizarHorario(h) {
  if (!h) return HORARIO_PADRAO;
  const [hh, mm] = String(h).split(':');
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Retorna as sessões que devem receber um Lembrete Proativo agora.
 * Uma sessão é devida quando:
 *   - o horário preferido (ou o default 09:00) corresponde à hora de `agora`
 *   - ainda não recebeu lembrete no mesmo dia (idempotência)
 *
 * @param {object[]} sessions — sessões com { chatId, user: { pref_horario } }
 * @param {Date} agora
 * @returns {object[]}
 */
function lembretesDevidos(sessions, agora = new Date()) {
  const { hh, mm } = horaLocal(agora);
  const hhmmAtual = `${hh}:${mm}`;
  return sessions.filter((s) => {
    if (!s.user) return false;

    const pref = normalizarHorario(s.user.pref_horario);
    if (pref !== hhmmAtual) return false;

    if (s.ultimoLembreteEm) {
      const ultimo = new Date(s.ultimoLembreteEm);
      if (ultimo.toDateString() === agora.toDateString()) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Retorna atividades com data_hora no futuro, ordenadas da mais próxima
 * para a mais distante. Ignora atividades passadas.
 *
 * @param {object[]} atividades — atividades com { nome, data_hora }
 * @param {Date} agora
 * @returns {object[]}
 */
function atividadesFuturas(atividades, agora = new Date()) {
  return atividades
    .filter((a) => new Date(a.data_hora).getTime() > agora.getTime())
    .sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora));
}

/**
 * Retorna as sessões sem interação há `dias` ou mais. Uma sessão é
 * considerada inativa quando ultimaInteracaoEm é igual ou anterior ao corte.
 * Sessões sem interação registrada não são retornadas.
 *
 * @param {object[]} sessions — sessões com { chatId, ultimaInteracaoEm }
 * @param {number} dias
 * @param {Date} [agora]
 * @returns {object[]}
 */
function inativosDesde(sessions, dias, agora = new Date()) {
  const corte = agora.getTime() - dias * 24 * 3600 * 1000;
  return sessions.filter((s) => {
    if (!s.ultimaInteracaoEm) return false;
    return new Date(s.ultimaInteracaoEm).getTime() <= corte;
  });
}

module.exports = { lembretesDevidos, atividadesFuturas, inativosDesde, normalizarHorario, horaLocal, HORARIO_PADRAO, FUSO_BRASILIA_HORAS };