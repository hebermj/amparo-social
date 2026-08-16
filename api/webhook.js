/**
 * ── Webhook do Telegram (Vercel Serverless) ────────────────────
 * Recebe mensagens do Telegram, processa com IA e executa ferramentas.
 *
 * Fluxo de busca web:
 *   1. LLM retorna "[[BUSCAR:termo]] texto..."
 *   2. Sistema executa search.js com o termo
 *   3. Se achou resultados → nova chamada LLM para formatar
 *   4. Se não achou → usa o texto original (limpo dos marcadores)
 */

const { sendMessage } = require('./_lib/telegram');
const { processWithLLM, cleanToolMarkers } = require('./_lib/llm');
const { getSession, saveSession, listarSessoes } = require('./_lib/db');
const { recomendarComFallback, recomendarAtividades } = require('./_lib/activities');
const { buscarAtividades } = require('./_lib/search');
const { lembretesDevidos, atividadesFuturas, inativosDesde } = require('./_lib/proativo');
const {
  mensagemStart,
  mensagemSemAtividades,
  mensagemAtividades,
  mensagemBuscaPensando,
  mensagemBuscaResultados,
  mensagemBuscaVazia,
  mensagemLembrete,
  mensagemIncentivo,
} = require('./_lib/mensagens');

// ── Utilitários ────────────────────────────────────────────────

function extractMessage(body) {
  if (body.message) {
    return {
      chatId: body.message.chat.id,
      text: body.message.text || '',
      firstName: body.message.from?.first_name || '',
    };
  }
  if (body.callback_query) {
    return {
      chatId: body.callback_query.message.chat.id,
      text: body.callback_query.data,
      firstName: body.callback_query.from?.first_name || '',
    };
  }
  return null;
}

/**
 * Extrai comandos de ferramenta da resposta crua da IA.
 * Cada marcador [[COMANDO:param]] vira um tool objeto.
 */
function parseTools(reply) {
  const tools = [];

  // [[RECOMENDAR:bairro:interesse1,interesse2]]
  const rec = reply.match(/\[\[RECOMENDAR:([^\]]+)\]\]/);
  if (rec) {
    const [bairro, interessesStr] = rec[1].split(':');
    tools.push({
      type: 'recomendar',
      bairro: (bairro || '').trim(),
      interesses: interessesStr ? interessesStr.split(',').map((s) => s.trim()) : [],
    });
  }

  // [[BUSCAR:termo de busca]]
  const bus = reply.match(/\[\[BUSCAR:([^\]]+)\]\]/);
  if (bus) {
    tools.push({
      type: 'buscar',
      termo: bus[1].trim(),
    });
  }

  // [[PERFIL:nome:cidade:bairro:interesse1,interesse2]]
  const perfil = reply.match(/\[\[PERFIL:([^\]]+)\]\]/);
  if (perfil) {
    const [nome, cidade, bairro, interessesStr] = perfil[1].split(':');
    tools.push({
      type: 'perfil',
      nome: (nome || '').trim(),
      cidade: (cidade || '').trim(),
      bairro: (bairro || '').trim(),
      interesses: interessesStr ? interessesStr.split(',').map((s) => s.trim()) : [],
    });
  }

  // [[HORARIO:hh:mm]]
  const horario = reply.match(/\[\[HORARIO:([0-9]{1,2}:[0-9]{2})\]\]/);
  if (horario) {
    const [hh, mm] = horario[1].split(':').map(Number);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) {
      tools.push({ type: 'horario', horario: horario[1].trim() });
    }
  }

  return tools;
}

// ── Ferramentas ────────────────────────────────────────────────

async function executarRecomendar(chatId, cidade, bairro, interesses) {
  const { origem, atividades } = await recomendarComFallback(cidade, bairro, interesses);
  if (atividades.length === 0) {
    await sendMessage(chatId, mensagemSemAtividades());
    return;
  }
  await sendMessage(chatId, mensagemAtividades(atividades, origem));
}

/**
 * Executa a busca web e retorna o texto adaptado para o usuário.
 * NUNCA lança exceção — sempre retorna texto ou null.
 */
async function executarBusca(chatId, termo, session) {
  try {
    await sendMessage(chatId, mensagemBuscaPensando());

    const resultados = await buscarAtividades([termo], session.user?.cidade);

    if (resultados.length === 0) {
      return null;
    }

    return mensagemBuscaResultados(resultados);

  } catch (err) {
    console.error('[BUSCA ERROR]', err.message);
    // Se a busca falhar, usa o texto original da LLM (fallback)
    return null;
  }
}

// ── Lembretes Proativos (cron) ────────────────────────────────

/**
 * Executado pelo Vercel Cron (User-Agent: vercel-cron/1.0).
 * Para cada sessão devida (horário preferido == hora atual, ainda não
 * notificada hoje), envia um Lembrete Proativo com a atividade futura
 * mais próxima. Idempotente: marca ultimoLembreteEm.
 */
async function executarLembretes(now) {
  const sessions = await listarSessoes();
  const devidos = lembretesDevidos(sessions, now);

  let enviados = 0;
  for (const sessao of devidos) {
    const chatId = sessao.chatId;
    try {
      const futuro = atividadesFuturas(
        recomendarAtividades(
          sessao.user?.cidade,
          sessao.user?.bairro,
          sessao.user?.interesses,
          50
        ),
        now
      );
      if (futuro.length === 0) continue;

      const proxima = futuro[0];
      const nome = sessao.user?.nome || '';

      await sendMessage(
        chatId,
        mensagemLembrete(nome, proxima)
      );

      sessao.ultimoLembreteEm = now.toISOString();
      await saveSession(chatId, sessao);
      enviados += 1;
    } catch (err) {
      console.error(`[CRON] Falha no lembrete de ${chatId}:`, err.message);
    }
  }

  console.log(`[CRON] Lembretes: ${enviados} enviados de ${devidos.length} devidos.`);
  return enviados;
}

const DIAS_INATIVIDADE = 3;
const INTERVALO_INCENTIVO_MS = 7 * 24 * 3600 * 1000;

/**
 * Executado pelo Vercel Cron. Para cada usuário 3+ dias sem interagir,
 * envia uma mensagem acolhedora de incentivo retomando a conversa.
 * Idempotente: no máximo um incentivo a cada 7 dias por usuário.
 */
async function executarIncentivos(now) {
  const sessions = await listarSessoes();
  const inativos = inativosDesde(sessions, DIAS_INATIVIDADE, now);

  let enviados = 0;
  for (const sessao of inativos) {
    const chatId = sessao.chatId;
    try {
      const ultimoIncentivo = sessao.ultimoIncentivoEm;
      if (
        ultimoIncentivo &&
        now.getTime() - new Date(ultimoIncentivo).getTime() < INTERVALO_INCENTIVO_MS
      ) {
        continue;
      }

      const nome = sessao.user?.nome;
      await sendMessage(
        chatId,
        mensagemIncentivo(nome)
      );

      sessao.ultimoIncentivoEm = now.toISOString();
      await saveSession(chatId, sessao);
      enviados += 1;
    } catch (err) {
      console.error(`[CRON] Falha no incentivo de ${chatId}:`, err.message);
    }
  }

  console.log(`[CRON] Incentivos: ${enviados} enviados de ${inativos.length} inativos.`);
  return enviados;
}

// ── Handler Principal ──────────────────────────────────────────

module.exports = async (req, res) => {
  // Vercel Cron dispara um GET (não POST) com User-Agent "vercel-cron/1.0"
  // e o header x-vercel-cron-schedule. Verificamos antes do gate de método.
  const ehCron = req.headers['user-agent']?.includes('vercel-cron');

  if (ehCron) {
    try {
      const lembretes = await executarLembretes(new Date());
      const incentivos = await executarIncentivos(new Date());
      return res.status(200).json({ status: 'cron', lembretes, incentivos });
    } catch (err) {
      console.error('[CRON ERROR]', err.message);
      return res.status(200).json({ status: 'cron_error', error: err.message });
    }
  }

  if (req.method !== 'POST') {
    return res.status(200).json({ status: 'ok' });
  }

  try {
    const msg = extractMessage(req.body);
    if (!msg || !msg.text) {
      return res.status(200).json({ status: 'ignored' });
    }

    const chatId = msg.chatId;
    const text = msg.text.trim();
    const session = await getSession(chatId);
    session.chatId = chatId;
    session.ultimaInteracaoEm = new Date().toISOString();
    session.ultimoIncentivoEm = null;

    // ── Comandos especiais (não passam pela LLM) ────────────
    if (text === '/start') {
      session.user = null;
      session.history = [];
      await saveSession(chatId, session);
      await sendMessage(
        chatId,
        mensagemStart()
      );
      return res.status(200).json({ status: 'start' });
    }

    if (text === '/atividades') {
      await saveSession(chatId, session);
      return await executarRecomendar(chatId, session.user?.cidade, session.user?.bairro, session.user?.interesses);
    }

    // ── Processamento com IA ────────────────────────────────
    const rawReply = await processWithLLM(text, session);

    // Mensagem de erro direta
    if (rawReply.startsWith('❌')) {
      await saveSession(chatId, session);
      await sendMessage(chatId, rawReply);
      return res.status(200).json({ status: 'error', error: rawReply });
    }

    // Extrai e executa ferramentas da resposta crua
    const tools = parseTools(rawReply);

    let textoFinal = cleanToolMarkers(rawReply);

    for (const tool of tools) {
      switch (tool.type) {
        case 'perfil':
          session.user = session.user || {};
          if (tool.nome) session.user.nome = tool.nome;
          if (tool.cidade) session.user.cidade = tool.cidade;
          if (tool.bairro) session.user.bairro = tool.bairro;
          if (tool.interesses.length) {
            session.user.interesses = [
              ...new Set([...(session.user.interesses || []), ...tool.interesses]),
            ];
          }
          break;

        case 'recomendar':
          await executarRecomendar(chatId, session.user?.cidade, tool.bairro, tool.interesses);
          break;

        case 'horario':
          session.user = session.user || {};
          session.user.pref_horario = tool.horario;
          // A confirmação (ecoando o horário) vem do texto limpo da LLM
          break;

        case 'buscar': {
          const resultadoBusca = await executarBusca(chatId, tool.termo, session);
          if (resultadoBusca) {
            textoFinal = resultadoBusca;
          } else {
            textoFinal = mensagemBuscaVazia();
          }
          break;
        }
      }
    }

    // Persiste a memória do usuário no banco
    await saveSession(chatId, session);

    // Envia o texto final (limpo) para o usuário
    if (textoFinal && textoFinal.trim()) {
      await sendMessage(chatId, textoFinal);
    }

    return res.status(200).json({ status: 'processed' });
  } catch (err) {
    console.error('[WEBHOOK ERROR]', err.message);
    return res.status(200).json({ status: 'error', error: err.message });
  }
};

module.exports.parseTools = parseTools;