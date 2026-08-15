/**
 * ── Persistência de Sessões ────────────────────────────────────
 * Guarda a memória de cada usuário (perfil e histórico)
 * em PostgreSQL. Se DATABASE_URL não estiver configurada,
 * usa um Map em memória (modo de desenvolvimento / fallback).
 */

const { Pool } = require('pg');

// ── Configuração ──────────────────────────────────────────────
const DATABASE_URL = process.env.DATABASE_URL;
const POOL_MAX = parseInt(process.env.DB_POOL_MAX || '1', 10);

let pool = null;
let initPromise = null;

if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    max: POOL_MAX,
    idleTimeoutMillis: 0,
  });
}

// Fallback em memória quando não há banco configurado
const memoryStore = new Map();

// ── Sessão padrão ─────────────────────────────────────────────
function novoSession() {
  return {
    history: [],
    user: null, // { nome, cidade, bairro, interesses }
  };
}

// ── Inicialização do schema ───────────────────────────────────
async function initDb() {
  if (!pool || initPromise) return initPromise;

  initPromise = pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      chat_id    TEXT PRIMARY KEY,
      data       JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `).catch((err) => {
    console.error('[DB] Erro ao criar tabela:', err.message);
    initPromise = null;
  });

  return initPromise;
}

// ── Leitura ───────────────────────────────────────────────────
async function getSession(chatId) {
  const key = String(chatId);

  // Modo memória (fallback)
  if (!pool) {
    if (!memoryStore.has(key)) {
      memoryStore.set(key, novoSession());
    }
    return memoryStore.get(key);
  }

  await initDb();
  const res = await pool.query(
    'SELECT data FROM sessions WHERE chat_id = $1',
    [key]
  );

  if (res.rows.length === 0) {
    const sessao = novoSession();
    await saveSession(chatId, sessao);
    return sessao;
  }

  return res.rows[0].data;
}

// ── Gravação ──────────────────────────────────────────────────
async function saveSession(chatId, session) {
  const key = String(chatId);

  if (!pool) {
    memoryStore.set(key, session);
    return;
  }

  await initDb();
  await pool.query(
    `INSERT INTO sessions (chat_id, data, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (chat_id)
     DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [key, JSON.stringify(session)]
  );
}

// ── Exclusão (LGPD / RF-005, RNF-011) ─────────────────────────
async function deleteSession(chatId) {
  const key = String(chatId);

  if (!pool) {
    memoryStore.delete(key);
    return;
  }

  await initDb();
  await pool.query('DELETE FROM sessions WHERE chat_id = $1', [key]);
}

// ── Listagem (usada pelos envios proativos do cron) ──────────
async function listarSessoes() {
  if (!pool) {
    const todas = [];
    for (const [chatId, sessao] of memoryStore.entries()) {
      todas.push({ chatId, ...sessao });
    }
    return todas;
  }

  await initDb();
  const res = await pool.query('SELECT chat_id, data FROM sessions');
  return res.rows.map((r) => ({
    chatId: r.chat_id,
    ...r.data,
  }));
}

module.exports = { getSession, saveSession, deleteSession, listarSessoes };
