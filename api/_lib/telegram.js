/**
 * ── Helpers Telegram Bot API ──────────────────────────────────
 * Envio de mensagens e formatação para o Telegram.
 */

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

/**
 * Envia mensagem de texto para um chat do Telegram.
 * @param {number|string} chatId
 * @param {string} text
 * @param {object} [extra] - Opções extras (parse_mode, reply_markup, etc.)
 */
async function sendMessage(chatId, text, extra = {}) {
  const body = {
    chat_id: chatId,
    text,
    ...extra,
  };

  const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram API: ${err}`);
  }

  return res.json();
}

/**
 * Envia mensagem com teclado inline (botões).
 * @param {number|string} chatId
 * @param {string} text
 * @param {Array<{text:string,callback_data:string}>} buttons
 */
async function sendKeyboard(chatId, text, buttons) {
  return sendMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: buttons.map((btn) => [btn]),
    },
  });
}

module.exports = { sendMessage, sendKeyboard };
