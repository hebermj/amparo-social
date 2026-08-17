/**
 * ── Base de Atividades ─────────────────────────────────────────
 * Catálogo curado de atividades comunitárias. No MVP, os dados são
 * carregados de arquivos JSON em data/ (um arquivo por cidade, no
 * formato atividades-<cidade>.json).
 * Em versões futuras, virão de um banco PostgreSQL.
 */

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', '..', 'data');

/**
 * Converte "santo-andre" → "Santo André".
 */
function nomeDaCidade(arquivo) {
  return arquivo
    .replace(/^atividades-/, '')
    .replace(/\.json$/, '')
    .split('-')
    .filter(Boolean)
    .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
    .join(' ');
}

let atividades = [];

try {
  const arquivos = fs
    .readdirSync(dataDir)
    .filter((f) => f.startsWith('atividades-') && f.endsWith('.json'));

  for (const arquivo of arquivos) {
    const cidade = nomeDaCidade(arquivo);
    const lista = JSON.parse(
      fs.readFileSync(path.join(dataDir, arquivo), 'utf-8')
    );
    lista.forEach((a) => {
      atividades.push({ cidade, ...a });
    });
  }
} catch (err) {
  console.warn('[ATIVIDADES] Erro ao carregar JSON:', err.message);
}

/**
 * Retorna atividades filtradas por cidade, bairro e/ou interesses.
 * @param {string} [cidade]
 * @param {string} [bairro]
 * @param {string[]} [interesses]
 * @param {number} [limite=5] — quantidade máxima de resultados
 * @returns {object[]}
 */
function recomendarAtividades(cidade, bairro, interesses = [], limite = 5) {
  let resultado = [...atividades];

  // Filtra por cidade (se informada)
  if (cidade) {
    const cidadeLower = cidade.toLowerCase();
    resultado = resultado.filter(
      (a) => a.cidade.toLowerCase().includes(cidadeLower)
    );
  }

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

  // Retorna até `limite` resultados
  return resultado.slice(0, limite);
}

/**
 * Retorna atividades disponíveis para HOJE, em uma cidade.
 */
function atividadesHoje(cidade) {
  const hoje = new Date().toISOString().split('T')[0];
  return atividades.filter(
    (a) =>
      (!cidade || a.cidade.toLowerCase() === cidade.toLowerCase()) &&
      a.data_hora.startsWith(hoje)
  );
}

module.exports = {
  recomendarAtividades,
  atividadesHoje,
};