# 🌻 Amparo — Plataforma de Envelhecimento Ativo e Inclusão Social

Assistente conversacional via **Telegram** que combate o isolamento social de
pessoas idosas, conectando-as a atividades comunitárias, culturais e sociais
perto de casa.

O Amparo conversa em linguagem simples e acolhedora, recomenda atividades
baseadas no perfil de cada usuário e incentiva a participação social.

---

## ✨ Funcionalidades

| Módulo | Descrição |
|--------|-----------|
| **Cadastro e perfil** | Nome → Cidade → Bairro → Interesses, salvos por usuário |
| **Recomendação de atividades** | Filtra a base local por cidade, bairro e interesses |
| **Busca sempre + Curadoria da IA** | Em todo Pedido de Atividade, busca na web (SearXNG) e cura pela IA |
| **Memória persistente** | Perfil, histórico e proteções de cada usuário salvos no banco |

---

## 🧠 Como funciona

```
Usuário (Telegram)
   │
   ▼
Webhook (Vercel Serverless — api/webhook.js)
   │
   ├── Comandos diretos: /start
   │
   ├── Pedido de Atividade (detecção por heurística, sem depender da IA)
   │    └── orquestrador: busca sempre (SearXNG) + Base + Curadoria da IA
   │        └── cache 1h + rate-limit 10/h (session.busca)
   │
   └── IA (api/_lib/llm.js)
         OpenCode Zen → OpenRouter (fallback)
         │
         ▼
      Resposta crua com marcadores de ferramenta
      [[PERFIL:...]] [[HORARIO:...]]
         │
         ▼
      Webhook executa a ferramenta e envia o texto limpo
```

A IA decide quando usar uma ferramenta e devolve um marcador no formato
`[[FERRAMENTA:parâmetros]]`. O webhook interpreta, executa e envia apenas o
texto amigável para o idoso.

### Ferramentas da IA

| Marcador | Ação |
|----------|------|
| `[[PERFIL:nome:cidade:bairro:interesses]]` | Salva o cadastro do usuário |
| `[[HORARIO:hh:mm]]` | Define o horário preferido de lembretes |

> Os marcadores `[[RECOMENDAR:]]` e `[[BUSCAR:]]` foram **aposentados**: o
> Pedido de Atividade é detectado por heurística e não depende da LLM (ADR-0005).

---

## 🏗️ Arquitetura

```
api/
├── webhook.js          → Handler principal do Telegram (Vercel)
└── _lib/
    ├── db.js           → Persistência PostgreSQL (memória por usuário)
    ├── llm.js          → Gateway LLM com fallback entre provedores
    ├── prompt.js       → System prompt dinâmico (persona Amparo)
    ├── activities.js   → Base local de atividades (JSON por cidade)
    ├── search.js       → Busca web (SearXNG)
    ├── curadoria.js    → Curadoria da IA (curarResultados)
    ├── pedido-atividades.js → Orquestrador (busca sempre + cache + rate-limit)
    └── telegram.js     → Helpers da Telegram Bot API

data/
└── atividades-<cidade>.json   → Catálogo curado (um arquivo por cidade)
```

---

## 🚀 Deploy

Hospedado na **Vercel** como função serverless. O bot responde a updates do
Telegram via webhook.

1. Crie um bot com o [@BotFather](https://t.me/BotFather) e copie o token.
2. Implante o repositório na Vercel.
3. Configure o webhook do Telegram:

```bash
curl -X POST "https://api.telegram.org/bot<SEU_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://SEU_DOMINIO.vercel.app/api/webhook"}'
```

4. Defina as variáveis de ambiente (veja abaixo).

### Variáveis de ambiente (`.env`)

```env
# Obrigatório — Telegram
TELEGRAM_BOT_TOKEN=

# Obrigatório (pelo menos um) — LLM
OPENCODE_ZEN_API_KEY=
OPENROUTER_API_KEY=

# Recomendado — memória persistente por usuário (PostgreSQL)
DATABASE_URL=postgresql://user:***@host:5432/amparo_social

# Recomendado — busca web (Instância SearXNG Própria, único provedor)
# Sem fallback comunitário; se a Instância cair, a Recomendação sai só da Base.
SEARXNG_URL=
SEARXNG_USER=
SEARXNG_PASSWORD=

# Opcional — cidade padrão para novos usuários
CIDADE_PADRAO=Santo André
```

> Sem `DATABASE_URL`, o bot funciona com memória volátil (perdida a cada
> reinício) — útil apenas para desenvolvimento.

---

## 💻 Desenvolvimento local

```bash
npm install
cp .env.example .env.local   # preencha as chaves
npm run dev                  # node api/webhook.js
```

Para testar com o Telegram localmente, exponha o servidor com um túnel
(ngrok, cloudflared) e aponte o webhook para `https://SEU_TUNEL/api/webhook`.

---

## 🏙️ Adicionando uma nova cidade

Crie um arquivo `data/atividades-<cidade>.json` com o mesmo formato do
existente — **sem precisar alterar o código**. Exemplo:

```json
[
  {
    "id": 1,
    "nome": "Oficina de Pintura em Tela",
    "descricao": "Turma para iniciantes e intermediários.",
    "categoria": "cultura",
    "tipo": "oficina",
    "data_hora": "2026-07-06T14:00:00",
    "endereco": "Sesc — Rua Tamarutaca, 302",
    "bairro": "Vila Bastos",
    "cidade": "Santo André",
    "parceiro": "Sesc",
    "contato": "(11) 4469-1200",
    "link_inscricao": ""
  }
]
```

Categorias disponíveis: `cultura`, `esporte`, `educacao`, `saude`,
`voluntariado`.

---

## 📚 Documentação

- [`SRS_Amparo_Social.md`](SRS_Amparo_Social.md) — Especificação de Requisitos
  de Software (requisitos funcionais, não funcionais, modelagem e roadmap)
- [`docs/plano-modulo-busca-web.md`](docs/plano-modulo-busca-web.md) — Plano do
  módulo de pesquisa web

---

## 🗺️ Roadmap

| Versão | Foco |
|--------|------|
| V1 (MVP) | Cadastro, recomendação, missões, conversação em texto |
| V2 | Transcrição de áudio, botões interativos, IA proativa |
| V3 | Calendários públicos integrados, raspagem automática |
| V4 | Expansão para múltiplas cidades, painel administrativo |

---

**© 2026 — Projeto Amparo**