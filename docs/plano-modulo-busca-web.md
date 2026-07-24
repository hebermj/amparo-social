# Plano: Módulo de Pesquisa Web para Atividades

## 1. Objetivo

Quando a base local de atividades (`atividades-santo-andre.json`) não tiver opções suficientes, 
ou quando o idoso pedir algo muito específico, o sistema deve **pesquisar na internet** por 
atividades reais em Santo André e arredores, trazendo resultados frescos e variados.

---

## 2. Fluxo de Decisão

```
Usuário pergunta sobre atividades
         │
         ▼
   Base local (atividades-santo-andre.json)
         │
         ├── achou 3+ atividades? → exibe normalmente
         │
         └── achou < 3 ou usuário pediu algo específico?
                      │
                      ▼
         🔍 Módulo de Pesquisa Web
                      │
                      ▼
         Resultados brutos da busca
                      │
                      ▼
         LLM filtra e adapta os resultados
         para linguagem simples e amigável
                      │
                      ▼
         Exibe para o idoso
```

### Exemplo

**Idoso:** "Tem alguma oficina de cerâmica perto de casa?"  
**Base local:** 0 resultados  
**Pesquisa Web:** "oficina cerâmica Santo André idosos"  
**Resultado:** "Ateliê de Cerâmica Vila Floresta — Rua das Flores, 120 — quartas 14h"  
**IA exibe:** *"Sra. Maria, encontrei um ateliê de cerâmica pertinho da senhora! 🎨 Fica na Rua das Flores, 120, toda quarta às 14h. Que tal?"*

---

## 3. API de Busca — Opções Grátis

| API | Limite Grátis | Português | Chave necessária? |
|-----|---------------|-----------|-------------------|
| **Bing Web Search** (Azure) | 1.000 chamadas/mês | ✅ Ótimo | ✅ Sim (grátis) |
| **SerpAPI** | 100 buscas/mês | ✅ Bom | ✅ Sim (grátis) |
| **Perplexity Sonar Free** | 5 chamadas/min (via API) | ✅ Bom | ✅ Já temos! |
| **DuckDuckGo Lite** | Ilimitado | ✅ Razoável | ❌ Não precisa |

### Recomendação: **Bing Search API** 🏆

| Motivo | Detalhe |
|--------|---------|
| Limite generoso | 1.000 chamadas/mês grátis |
| Língua portuguesa | Excelente para Brasil |
| Resultados estruturados | Retorna nome, endereço, descrição |
| Fácil integração | API REST simples (1 endpoint) |

---

## 4. Estrutura do Módulo

```
api/_lib/
├── search.js            ← NOVO Módulo de pesquisa web
│   └── buscarAtividades(termo, cidade)
│       └── faz a chamada para Bing API
│       └── retorna array de resultados padronizados
│
├── activities.js        ← (MODIFICADO)
│   └── recomendarAtividades(bairro, interesses)
│       ├── consulta base local
│       └── se < 3 resultados → chama search.buscarAtividades()
│
└── llm.js               ← (MODIFICADO)
    └── NOVO marcador: [[BUSCAR:interesses]]
        └── webhook.js executa e retorna via activities.js
```

### Contrato da API interna

```javascript
// api/_lib/search.js

async function buscarAtividades(termo, cidade = 'Santo André') {
  // Exemplo de retorno:
  return [
    {
      nome: 'Oficina de Cerâmica',
      descricao: 'Aulas de cerâmica para iniciantes',
      endereco: 'Rua das Flores, 120 — Santo André',
      data_hora: 'quartas, 14h',
      link: 'https://...'
    }
  ];
}
```

### Exemplo de chamada Bing API

```http
GET https://api.bing.microsoft.com/v7.0/search
  ?q=oficina+cerâmica+Santo+André+idosos+gratuito
  &count=5
  &mkt=pt-BR
  
Headers:
  Ocp-Apim-Subscription-Key: SUA_CHAVE
```

Resposta da Bing inclui:
- `webPages.value[].name` — título
- `webPages.value[].snippet` — descrição
- `webPages.value[].url` — link

---

## 5. Integração com o Prompt da IA

Novo marcador de ferramenta a ser adicionado ao `prompt.js`:

```
## buscar_online
USE quando: usuário pedir algo específico não encontrado na base local
FORMATO: [[BUSCAR:termo de busca]]

EXEMPLO:
USUÁRIO: Tem aula de cerâmica?
AMPARO: [[BUSCAR:aula cerâmica Santo André idosos]]
Vou pesquisar! Deixa eu ver o que encontro...
```

---

## 6. Tratamento dos Resultados

A LLM recebe os resultados brutos da busca e:

1. **Seleciona** os mais relevantes para o perfil do idoso
2. **Traduz** para linguagem simples, sem links quebrados
3. **Formata** com endereço, dia/horário, e frase de incentivo
4. **Mantém no máximo 2 parágrafos** (regra do prompt)

### Exemplo de fluxo completo

```
USUÁRIO: Quero aprender pintura
      ↓
LLM detecta: interesse novo = "pintura"
      ↓
Base local: 0 resultados para "pintura"
      ↓
[[BUSCAR:oficina pintura Santo André terceira idade]]
      ↓
Webhook: chama search.buscarAtividades('oficina pintura Santo André idosos')
      ↓
Resultados:
  1. "Oficina de Pintura em Tela - Sesc Santo André"
  2. "Ateliê Livre - Praça do Carmo"
      ↓
LLM adapta:
  "Sra. Maria, encontrei duas opções de pintura!
   1️⃣ Sesc Santo André (Rua Tamarutaca, 302) — quintas 14h
   2️⃣ Praça do Carmo — sábados 9h (ao ar livre)
   Qual mais te agrada? 🎨"
```

---

## 7. Limites e Segurança

- **Cache:** Resultados da busca são armazenados na sessão por 1 hora (evita chamadas repetidas)
- **Filtro de conteúdo:** Resultados passam pela LLM → só exibe atividades apropriadas para idosos
- **Sem links diretos:** A LLM nunca envia URLs cruas para o idoso (pode ser golpe)
- **Fallback:** Se a busca falhar (sem crédito, sem rede), cai no comportamento normal ("não encontrei")
- **Rate limit:** No máximo 5 buscas por sessão, por hora

---

## 8. Resumo do que precisa ser feito

| # | Tarefa | Arquivo |
|---|--------|---------|
| 1 | Criar módulo `search.js` com chamada Bing API | `api/_lib/search.js` |
| 2 | Adicionar `BUSCAR` ao `cleanToolMarkers` | `api/_lib/llm.js` |
| 3 | Adicionar `BUSCAR` ao `parseTools` no webhook | `api/webhook.js` |
| 4 | Implementar execução da busca no webhook | `api/webhook.js` |
| 5 | Adicionar `[[BUSCAR:...]]` no system prompt | `api/_lib/prompt.js` |
| 6 | Adicionar cache de resultados na sessão | `api/_lib/llm.js` |

### Dependências

- Criar conta no **Azure Bing Search** (gratuita) → obter chave
- Adicionar `BING_SEARCH_API_KEY` nas env vars do Vercel
- (Alternativa gratuita sem cadastro) DuckDuckGo Lite

---

Quer que eu comece a implementar? Ou ajustar algo no plano? 😊
