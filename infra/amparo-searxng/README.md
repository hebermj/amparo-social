# Instância SearXNG Própria do Amparo

Instância de busca dedicada do Amparo (ADR-0006): **única** provedora de
Resultados da Busca. Sem fallback para instâncias comunitárias — se ela
estiver indisponível, a Recomendação sai só da Base de Atividades.

```
Telegram → Vercel (api/webhook.js)
  → SEARXNG_URL = https://<maquina>.<tailnet>.ts.net   (Tailscale Funnel, HTTPS)
  → Caddy 127.0.0.1:8080  (basic_auth → sem credencial = 401)
  → SearXNG 127.0.0.1:8090 (contêiner dedicado, pt-BR, JSON)
```

## Subir o stack local

```bash
cd infra/amparo-searxng
./setup.sh            # gera .env (credenciais + segredos), fora do git
docker compose up -d  # sobe SearXNG (8090) + Caddy (8080), restart automático
```

Validação:

```bash
set -a && . ./.env && set +a
curl -i "http://127.0.0.1:8080/search?q=x&format=json"                 # → 401
curl -u "$SEARXNG_USER:$SEARXNG_PASSWORD" \
  "http://127.0.0.1:8080/search?q=caminhada%20idosos&format=json&language=pt-BR"  # → JSON pt-BR
```

> **Nota sobre o hash:** o Docker Compose interpola `$VAR` nos valores de
> `env_file`; por isso o `.env` guarda o hash bcrypt com `$` duplicados
> (`$$2a$$14$$…`). Sempre gere via `./setup.sh` — não cole um hash `$2a$…`
> manualmente no `.env`.

## Wizard — expor via Tailscale Funnel (passos do operador)

O Funnel é a via **sem domínio e grátis** (plano Personal), URL estável
`https://<maquina>.<tailnet>.ts.net`, HTTPS automático, funciona atrás de
CGNAT. Não tem camada de autenticação — a autenticação continua sendo o
`basic_auth` do Caddy.

```bash
# 1. Instalar o Tailscale (precisa de sudo; senha interativa)
sudo apt install -y tailscale          # Debian/Ubuntu

# 2. Autenticar (abre login no navegador; conta gratuita)
sudo tailscale up

# 3. Habilitar HTTPS + Funnel no admin console (login.tailscale.com):
#    - DNS → HTTPS Certificates: ON
#    - (o Funnel pede aprovação na primeira execução)

# 4. Expor o Caddy (127.0.0.1:8080) publicamente; Funnel re-inicia sozinho
sudo tailscale funnel 8080
#    Saída ex.: Available on the internet: https://minha-maquina.tailXXXX.ts.net

# 5. Anotar a URL → vira o SEARXNG_URL da Vercel
```

Validação de fora da máquina (qualquer rede, não só sua casa):

```bash
set -a && . infra/amparo-searxng/.env && set +a
curl -i "https://<maquina>.<tailnet>.ts.net/search?q=x&format=json"                 # → 401
curl -u "$SEARXNG_USER:$SEARXNG_PASSWORD" \
  "https://<maquina>.<tailnet>.ts.net/search?q=caminhada&format=json&language=pt-BR" # → JSON
```

## Wizard — ligar a Vercel (passos do operador)

```bash
# 1. Autenticar + linkar o projeto (CLI vercel já instalado)
vercel login
vercel link            # aponta para o projeto "amparo-social"

# 2. Definir as variáveis em produção (o bot as lê via process.env)
vercel env add SEARXNG_URL production        # https://<maquina>.<tailnet>.ts.net
vercel env add SEARXNG_USER production       # o valor de SEARXNG_USER do .env
vercel env add SEARXNG_PASSWORD production   # o valor de SEARXNG_PASSWORD do .env

# 3. Deploy do código (ticket #19) e validação ponta a ponta
vercel --prod    # ou push no GitHub com integração Git
```

Critério ponta a ponta (#22): um Pedido de Atividade real no Telegram retorna
Recomendação em português vinda da Instância (log `[SEARCH] SearXNG: N
resultados`, rótulo de fonte). Com a Instância desligada, sai só da Base.