#!/usr/bin/env node
/**
 * Verifica a conexão PostgreSQL da aplicação (api/_lib/db.js).
 * Lê DATABASE_URL do ambiente, salva e relê uma sessão de teste.
 * Uso: DATABASE_URL="..." node scripts/test-db.js
 * Exit 0 quando a persistência funciona; 1 caso contrário.
 */

const { getSession, saveSession } = require('../api/_lib/db.js');

(async () => {
  if (!process.env.DATABASE_URL) {
    console.error('ERRO: DATABASE_URL não está definida no ambiente.');
    console.error('Uso: DATABASE_URL="..." node scripts/test-db.js');
    process.exit(2);
  }

  const chatId = `wizard-${Date.now()}`;
  const sessao = { user: { nome: 'Teste' }, history: [] };
  await saveSession(chatId, sessao);
  const lida = await getSession(chatId);
  if (lida && lida.user && lida.user.nome === 'Teste') {
    console.log('OK: conexão funciona, sessão persiste');
    process.exit(0);
  }
  console.error('ERRO: sessão não persiste (cold start simulado)');
  process.exit(1);
})();
