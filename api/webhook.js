/**
 * ── Webhook do Telegram (Vercel Serverless) ────────────────────
 * Recebe as mensagens do Telegram e processa com a IA.
 *
 * Endpoint: POST /api/webhook
 * Configuração: curl -X POST "https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://{URL}/api/webhook"
 */

const { sendMessage, sendKeyboard } = require('./_lib/telegram');
const { processWithLLM, getSession, cleanToolMarkers } = require('./_lib/llm');
const { recomendarAtividades, missaoAleatoria } = require('./_lib/activities');

/**
 * Extrai o texto e metadados da mensagem recebida do Telegram.
 */
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
      callbackQueryId: body.callback_query.id,
    };
  }
  return null;
}

/**
 * Extrai comandos de ferramenta da resposta da IA.
 * Formato: [[COMANDO:parametros]]
 */
function parseTools(reply) {
  const tools = [];
  const recMatch = reply.match(/\[\[RECOMENDAR:([^\]]+)\]\]/);
  if (recMatch) {
    const [bairro, interessesStr] = recMatch[1].split(':');
    tools.push({
      type: 'recomendar',
      bairro: (bairro || '').trim(),
      interesses: interessesStr ? interessesStr.split(',').map((s) => s.trim()) : [],
    });
  }
  const misMatch = reply.match(/\[\[MISSAO:([^\]]+)\]\]/);
  if (misMatch) {
    tools.push({ type: 'missao', usuarioId: misMatch[1].trim() });
  }
  const ptMatch = reply.match(/\[\[PONTOS:([^\]]+)\]\]/);
  if (ptMatch) {
    tools.push({ type: 'pontos', usuarioId: ptMatch[1].trim() });
  }
  const confMatch = reply.match(/\[\[CONFIRMAR:([^\]]+)\]\]/);
  if (confMatch) {
    tools.push({ type: 'confirmar', missaoId: confMatch[1].trim() });
  }
  return tools;
}

/**
 * Handler principal da Vercel.
 */
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

    // ── Comandos especiais ──────────────────────────────────
    if (text === '/start') {
      session.user = null;
      session.history = [];
      await sendMessage(
        chatId,
        `Olá! 🌻 Sou o **Amparo**, seu assistente de bem-estar digital.\n\n` +
        `Vou ajudar você a encontrar atividades sociais, culturais e de lazer perto da sua casa em **Santo André**.\n\n` +
        `Para começar, qual é o seu nome?`
      );
      return res.status(200).json({ status: 'start' });
    }

    if (text === '/atividades') {
      const atvs = recomendarAtividades(session.user?.bairro, session.user?.interesses);
      if (atvs.length === 0) {
        await sendMessage(chatId, 'Ainda não tenho atividades cadastradas para sua região. 😕\nEm breve traremos novidades!');
      } else {
        let resp = 'Aqui estão as atividades próximas de você:\n\n';
        atvs.forEach((a, i) => {
          const data = new Date(a.data_hora);
          const diaSem = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'][data.getDay()];
          resp += `${i + 1}. *${a.nome}*\n   📍 ${a.endereco}\n   📅 ${diaSem}, ${data.getHours()}h\n\n`;
        });
        resp += '_Qual delas te interessou? Posso ajudar com mais detalhes!_';
        await sendMessage(chatId, resp);
      }
      return res.status(200).json({ status: 'atividades' });
    }

    if (text === '/missao') {
      const missao = missaoAleatoria();
      if (!missao) {
        await sendMessage(chatId, 'Ainda não tenho missões disponíveis. 😕');
      } else {
        await sendMessage(
          chatId,
          `🌟 *Missão Social da Semana!* 🌟\n\n` +
          `Que tal visitar: *${missao.nome}*\n📍 ${missao.endereco}\n📅 ${missao.data_hora}\n\n` +
          `Quando for, me avise! Mande uma mensagem aqui confirmando. 🎉`
        );
      }
      return res.status(200).json({ status: 'missao' });
    }

    if (text === '/pontos') {
      await sendMessage(
        chatId,
        `⭐ *Seus Pontos Amparo:* ${session.pontos} pts\n\nContinue participando das missões para acumular mais pontos! 🎉`
      );
      return res.status(200).json({ status: 'pontos' });
    }

    // ── Processamento com IA ────────────────────────────────
    const rawReply = await processWithLLM(text, session);

    // Se a IA retornou uma mensagem de erro, não tenta parsear ferramentas
    if (rawReply.startsWith('❌')) {
      await sendMessage(chatId, rawReply);
      return res.status(200).json({ status: 'error', error: rawReply });
    }

    // Extrai comandos de ferramenta da resposta CRUA
    const tools = parseTools(rawReply);

    // Executa as ferramentas (cada uma envia sua própria mensagem)
    for (const tool of tools) {
      if (tool.type === 'recomendar') {
        const atvs = recomendarAtividades(tool.bairro, tool.interesses);
        if (atvs.length > 0) {
          const a = atvs[0];
          await sendMessage(
            chatId,
            `Encontrei esta atividade para você:\n\n*${a.nome}*\n📍 ${a.endereco}\n📅 ${a.data_hora}\n\n_Que tal dar uma passada lá?_ 😊`
          );
        } else {
          await sendMessage(
            chatId,
            'Não encontrei atividades para essa região no momento. 😕'
          );
        }
      } else if (tool.type === 'missao') {
        const missao = missaoAleatoria();
        if (missao) {
          await sendMessage(
            chatId,
            `🌟 Sua missão: *${missao.nome}*\n📍 ${missao.endereco}\n\nMe conte quando for!`
          );
        }
      } else if (tool.type === 'pontos') {
        await sendMessage(chatId, `⭐ *Pontos Amparo:* ${session.pontos} pts`);
      } else if (tool.type === 'confirmar') {
        session.pontos += 50;
        await sendMessage(
          chatId,
          `🎉 *Parabéns!* Missão concluída! Você ganhou **50 Pontos Amparo**!\nTotal: ${session.pontos} pts. Continue assim! 🌟`
        );
      }
    }

    // Limpa os marcadores e envia o texto para o usuário
    const cleanText = cleanToolMarkers(rawReply);
    if (cleanText) {
      await sendMessage(chatId, cleanText);
    }

    return res.status(200).json({ status: 'processed' });
  } catch (err) {
    console.error('[WEBHOOK ERROR]', err.message);
    return res.status(200).json({ status: 'error', error: err.message });
  }
};
