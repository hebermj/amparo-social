# Plano: Módulo de Busca Web para Atividades

> **Status: implementado** — descreve o pipeline **Busca sempre + Curadoria da IA**
> entregue nos tickets T1–T3 (spec #9). Substitui o plano original que previa
> fallback via Bing API e marcador `[[BUSCAR:]]` — ambos removidos (ver ADR-0005).

## 1. Objetivo

Quando o usuário faz um **Pedido de Atividade**, o sistema **sempre** busca na
internet por atividades reais em Santo André e arredores (via SearXNG próprio ou
comunitário), mescla com a Base de Atividades local, passa pela **Curadoria da IA**
e entrega uma mensagem final em linguagem simples — sem URLs cruas, sem emojis e
com rótulo de fonte. O caminho de atividade **não depende da LLM de chat**: a
detecção é por heurística no webhook, então funciona mesmo sob rate-limit da IA.

## 2. Fluxo de Decisão

```
Usuário faz Pedido de Atividade ("/atividades" ou mensagem detectada)
         │
         ▼
   Heurística: parecePedidoDeAtividades(texto)
         │
         ▼
   Orquestrador processarPedidoDeAtividades(texto, sessão)
         │
         ├── Cache-hit (1h, por termo normalizado)?
         │     → template direto (pula busca web E curadoria; não conta hit)
         │
         ├── Rate-limit 10 buscas/hora atingido?
         │     → Base curada (curadoria só com a Base; sem Busca Web)
         │
         └── Folga
               ├── 1. Base de Atividades (amplia bairros se necessário)
               ├── 2. Busca Web SEMPRE (SearXNG) + registra hit + cache
               ├── 3. Fusão base+web com origem marcada (top 5 web)
               ├── 4. Curadoria da IA (curarResultados) — prefere a Base
               │        └── falha/saída inválida → template tolerante
               └── 5. Pedido+resposta no histórico
```

### Exemplo

**Usuário:** "Tem alguma oficina de cerâmica perto de casa?"
**Detecção:** heurística (palavra "oficina")
**Termo:** "cerâmica Santo André idosos atividades" (mensagem + perfil + cidade)
**Resultados:** Base (Sesc) + Ateliê da Web (SearXNG)
**Curadoria:** seleciona e escreve a mensagem final, sem URLs cruas, com fonte

## 3. API de Busca — Sem Chave

| Provedor | Limite | Português | Chave necessária? |
|----------|--------|-----------|-------------------|
| **SearXNG** (próprio) | Controlado pelo operador | Bom | Não (autenticação opcional) |
| **SearXNG** (comunitário) | Variável | Bom | Não |

> O Bing Web Search foi **removido** (commit `19171ba`) em favor de instâncias
> SearXNG. Não há chave obrigatória e não há fallback para um segundo provedor:
> se o SearXNG falhar, o fluxo segue só com a Base de Atividades.

## 4. Estrutura do Módulo

```
api/_lib/
├── pedido-atividades.js   ← Orquestrador (seam único com deps injetáveis)
│   ├── parecePedidoDeAtividades(texto)        → heurística de detecção
│   ├── processarPedidoDeAtividades(texto, sessão)
│   │     ├── cache 1h (session.busca.cache)
│   │     ├── rate-limit 10/h (session.busca.hits)
│   │     ├── mescla Base + top 5 web (origem marcada)
│   │     └── curarResultados → fallback template
│   └── montarTermoPadrao(texto, sessão)       → termo mensagem+perfil+cidade
│
├── search.js              ← Busca web SearXNG
│   ├── buscarPorTermo(termo)                  → resultados normalizados
│   └── montarTermoBusca(mensagem, interesses, cidade)
│
├── curadoria.js           ← Curadoria da IA (T2)
│   ├── curarResultados(itens, sessão)         → única chamada LLM do caminho
│   └── validarCuradoria(resposta, itens)      → vazio/URL/emoji/parágrafo/atividade
│
├── activities.js          ← Base de Atividades local (recomendarAtividades)
├── mensagens.js           ← Templates (mensagemAtividades tolerante, sem URLs)
└── llm.js                 ← Gateway LLM (completarComLLM reusado pela curadoria)
```

## 5. Proteções de Sessão (T3)

`session.busca = { cache: { termo: { ts, resultados } }, hits: [timestamps] }`

- **Cache 1h** por termo normalizado (caixa/acentos), mapa de ~3 termos com
  eviction por idade > 60 min. Em cache-hit, a mensagem sai pelo **template direto**
  (pula busca web e curadoria) e **não** conta para o rate-limit.
- **Rate-limit 10/h** em janela de 60 min corridos, contando só buscas explícitas
  (`/atividades` e Pedidos de Atividade detectados compartilham o contador). No
  estouro, o fluxo cai para a **Base curada**; o template só aparece se a própria
  curadoria falhar.
- Cache e hits persistem via `saveSession`, sobrevivendo a cold start quando há
  `DATABASE_URL`.

## 6. Curadoria da IA (T2)

A LLM (via `completarComLLM`, mesmo gateway do chat) recebe a fusão Base + web
com campo `origem` (`base`|`web`) e é instruída a **preferir a Base** quando
relevante. Regras da resposta: máx. 2 parágrafos, zero emojis, sem URLs cruas,
rótulo de fonte para itens da web. A saída é validada; se falhar/vier vazia/
contiver URL/emojis/mais de 2 parágrafos/sem nenhuma atividade, o orquestrador
cai no template tolerante.

## 7. Limites e Segurança

- **Sem URLs cruas:** nem a curadoria (o prompt não recebe `link`) nem o template
  expõem URLs ao usuário idoso — mitigação contra golpe.
- **Resiliência:** o caminho de atividade funciona mesmo com a LLM de chat em
  rate-limit (detecção por heurística + template).
- **Custo:** 1 busca SearXNG por termo a cada 1h, no máx. 10/hora por sessão.
- **Curadoria:** uma única chamada LLM por Pedido de Atividade.

## 8. Status de Implementação

| Ticket | Entregue em |
|--------|-------------|
| T1 — Detecção por heurística + orquestrador + busca sempre | `9cc4f42` |
| T2 — Curadoria da IA (curarResultados) | `8351bf7` |
| T3 — Cache 1h + rate-limit 10/h na Sessão | `4a4b4fa` |