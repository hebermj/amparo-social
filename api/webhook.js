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
const { processWithLLM, getSession, cleanToolMarkers } = require('./_lib/llm');
const { recomendarAtividades, missaoAleatoria } = require('./_lib/activities');
const { buscarAtividades } = require('./_lib/search');

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

  // [[MISSAO:usuario_id]]
  if (reply.match(/\[\[MISSAO:[^\]]+\]\]/)) {
    tools.push({ type: 'missao' });
  }

  // [[PONTOS:usuario_id]]
  if (reply.match(/\[\[PONTOS:[^\]]+\]\]/)) {
    tools.push({ type: 'pontos' });
  }

  // [[CONFIRMAR:missao_id]]
  if (reply.match(/\[\[CONFIRMAR:[^\]]+\]\]/)) {
    tools.push({ type: 'confirmar' });
  }

  // [[BUSCAR:termo de busca]]
  const bus = reply.match(/\[\[BUSCAR:([^\]]+)\]\]/);
  if (bus) {
    tools.push({
      type: 'buscar',
      termo: bus[1].trim(),
    });
  }

  return tools;
}

// ── Ferramentas ────────────────────────────────────────────────

async function executarRecomendar(chatId, bairro, interesses) {
  const atvs = recomendarAtividades(bairro, interesses);
  if (atvs.length === 0) {
    await sendMessage(chatId, 'Não encontrei atividades cadastradas para essa região no momento. 😕');
    return;
  }
  let resp = 'Aqui estão as atividades que encontrei:\n\n';
  atvs.forEach((a, i) => {
    const data = new Date(a.data_hora);
    const diaSem = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][data.getDay()];
    resp += `${i + 1}. *${a.nome}*\n   📍 ${a.endereco}\n   📅 ${diaSem}, ${data.getHours()}h\n\n`;
  });
  resp += '_Qual te interessou? Me fala!_ 😊';
  await sendMessage(chatId, resp);
}

async function executarMissao(chatId) {
  const missao = missaoAleatoria();
  if (!missao) {
    await sendMessage(chatId, 'Ainda não tenho missões disponíveis. 😕');
    return;
  }
  await sendMessage(
    chatId,
    `🌟 *Missão Social da Semana!* 🌟\n\n` +
    `Que tal visitar: *${missao.nome}*\n📍 ${missao.endereco}\n📅 ${missao.data_hora}\n\n` +
    `Quando for, me avise! 🎉`
  );
}

/**
 * Executa a busca web e retorna o texto adaptado para o usuário.
 * Se achou resultados: chama LLM novamente para formatar.
 * Se não achou: retorna null.
 */
async function executarBusca(chatId, termo, session) {
  await sendMessage(chatId, 'Vou pesquisar! 🔍 Só um instante...');

  const resultados = await buscarAtividades([termo]);

  if (resultados.length === 0) {
    return null;
  }

  // Prepara resumo dos resultados para a LLM
  const listaResultados = resultados
    .slice(0, 5)
    .map((r, i) => `${i + 1}. ${r.nome} — ${r.descricao.substring(0, 150)}`)
    .join('\n');

  // Segunda chamada LLM: formata os resultados de forma amigável
  const promptFormatador = `Você é o Amparo, assistente de bem-estar para idosos.
Sua função é transformar resultados de busca em uma mensagem acolhedora e simples.

Resultados da busca por "${termo}":
${listaResultados}

Regras:
- Máximo 2 parágrafos
- Linguagem simples, frases curtas
- NÃO use links ou URLs
- Inclua nome da atividade e endereço/bairro quando possível
- Termine com uma pergunta ou incentivo
- Tom caloroso e respeitoso`;

  const replyFormatado = await processWithLLM(
    `[SISTEMA] Formate estes resultados de busca para o idoso:\n${listaResultados}`,
    // Usa uma sessão descartável para não poluir o histórico do usuário
    { history: [] }
  );

  return replyFormatado;
}

// ── Handler Principal ──────────────────────────────────────────

module.exports = async (req, res) => {
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
    const session = getSession(chatId);

    // ── Comandos especiais (não passam pela LLM) ────────────
    if (text === '/start') {
      session.user = null;
      session.history = [];
      await sendMessage(
        chatId,
        'Olá! 🌻 Sou o **Amparo**, seu assistente de bem-estar digital.\n\n' +
        'Vou ajudar você a encontrar atividades sociais, culturais e de lazer perto da sua casa em **Santo André**.\n\n' +
        'Para começar, qual é o seu nome?'
      );
      return res.status(200).json({ status: 'start' });
    }

    if (text === '/atividades') {
      return await executarRecomendar(chatId, session.user?.bairro, session.user?.interesses);
    }

    if (text === '/missao') {
      return await executarMissao(chatId);
    }

    if (text === '/pontos') {
      await sendMessage(
        chatId,
        `⭐ *Seus Pontos Amparo:* ${session.pontos} pts\n\nContinue participando das missões! 🎉`
      );
      return res.status(200).json({ status: 'pontos' });
    }

    // ── Processamento com IA ────────────────────────────────
    const rawReply = await processWithLLM(text, session);

    // Mensagem de erro direta
    if (rawReply.startsWith('❌')) {
      await sendMessage(chatId, rawReply);
      return res.status(200).json({ status: 'error', error: rawReply });
    }

    // Extrai e executa ferramentas da resposta crua
    const tools = parseTools(rawReply);

    let textoFinal = cleanToolMarkers(rawReply);

    for (const tool of tools) {
      switch (tool.type) {
        case 'recomendar':
          await executarRecomendar(chatId, tool.bairro, tool.interesses);
          break;

        case 'missao':
          await executarMissao(chatId);
          break;

        case 'pontos':
          await sendMessage(chatId, `⭐ *Pontos Amparo:* ${session.pontos} pts`);
          break;

        case 'confirmar':
          session.pontos += 50;
          await sendMessage(
            chatId,
            `🎉 *Parabéns!* Missão concluída! Você ganhou **50 Pontos Amparo**!\nTotal: ${session.pontos} pts. Continue assim! 🌟`
          );
          break;

        case 'buscar': {
          const resultadoBusca = await executarBusca(chatId, tool.termo, session);
          if (resultadoBusca) {
            textoFinal = resultadoBusca;
          } else {
            textoFinal = 'Não encontrei atividades específicas para isso agora. 😕 Mas se quiser, posso tentar outro tipo de busca!';
          }
          break;
        }
      }
    }

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
