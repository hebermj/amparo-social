/**
 * ── Base de Atividades ─────────────────────────────────────────
 * Catálogo curado de atividades comunitárias em Santo André, SP.
 * No MVP, esses dados são carregados de um JSON estático.
 * Em versões futuras, virão de um banco PostgreSQL.
 */

const fs = require('fs');
const path = require('path');

// Carrega atividades do arquivo JSON
const atividadesPath = path.join(__dirname, '..', '..', 'data', 'atividades-santo-andre.json');
let atividades = [];

try {
  atividades = JSON.parse(fs.readFileSync(atividadesPath, 'utf-8'));
} catch (err) {
  console.warn('[ATIVIDADES] Erro ao carregar JSON:', err.message);
}

/**
 * Retorna atividades filtradas por bairro e/ou interesses.
 * @param {string} [bairro]
 * @param {string[]} [interesses]
 * @returns {object[]}
 */
function recomendarAtividades(bairro, interesses = []) {
  let resultado = [...atividades];

  // Filtra por bairro (se informado)
  if (bairro) {
    const bairroLower = bairro.toLowerCase();
    resultado = resultado.filter(
      (a) => a.bairro.toLowerCase().includes(bairroLower)
    );
  }

  // Filtra por interesses (se informados)
  if (interesses.length > 0) {
    resultado = resultado.filter((a) =>
      interesses.some((i) => a.categoria.toLowerCase().includes(i.toLowerCase()))
    );
  }

  // Ordena por data (mais próximos primeiro)
  resultado.sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora));

  // Retorna até 5 resultados
  return resultado.slice(0, 5);
}

/**
 * Retorna atividades disponíveis para HOJE.
 */
function atividadesHoje() {
  const hoje = new Date().toISOString().split('T')[0];
  return atividades.filter((a) => a.data_hora.startsWith(hoje));
}

/**
 * Retorna uma atividade aleatória para servir como missão social.
 */
function missaoAleatoria() {
  if (atividades.length === 0) return null;
  const idx = Math.floor(Math.random() * atividades.length);
  return atividades[idx];
}

module.exports = { recomendarAtividades, atividadesHoje, missaoAleatoria };
