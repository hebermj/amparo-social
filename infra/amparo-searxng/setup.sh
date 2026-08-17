#!/usr/bin/env bash
# Gera (ou regenera) o .env da Instância SearXNG Própria com segredos
# fortes e com o hash bcrypt já escapado para o Docker Compose.
# O Docker Compose interpola `$VAR` nos valores de env_file; a fuga `$$`
# garante que o hash `$2a$...` chegue intacto ao Caddy.
set -euo pipefail
cd "$(dirname "$0")"

SEARXNG_USER="${SEARXNG_USER:-amparo_bot}"
SEARXNG_PASSWORD="$(openssl rand -hex 18)"
SEARXNG_SECRET="$(openssl rand -hex 32)"

# Gera o hash com a MESMA imagem do Caddy do compose (bcrypt por padrão).
HASH="$(docker run --rm caddy:2-alpine caddy hash-password --plaintext "$SEARXNG_PASSWORD")"
# Dobra cada `$` → `$$`: o Docker Compose interpola `$$` como `$` literal.
HASH_ESCAPED="$(printf '%s' "$HASH" | sed 's/\$/$$/g')"

printf 'SEARXNG_USER=%s\nSEARXNG_PASSWORD=%s\nSEARXNG_PASSWORD_BCRYPT=%s\nSEARXNG_SECRET=%s\n' \
  "$SEARXNG_USER" "$SEARXNG_PASSWORD" "$HASH_ESCAPED" "$SEARXNG_SECRET" > .env
chmod 600 .env

echo "OK: credenciais geradas em .env (modo 600, fora do git)."
echo "Use SEARXNG_USER + SEARXNG_PASSWORD na Vercel (env do bot)."