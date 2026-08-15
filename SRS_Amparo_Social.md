# Documento de Especificação de Requisitos de Software (SRS)

## Amparo — Plataforma de Envelhecimento Ativo e Inclusão Social

**Versão:** 2.0  
**Data:** Agosto de 2026  
**Autor:** Heber

---

## 1. Introdução

### 1.1 Finalidade

Este documento especifica os requisitos de software do **Amparo**, uma plataforma conversacional via Telegram que utiliza inteligência artificial para combater o isolamento social da população idosa, promovendo envelhecimento ativo, autonomia e inclusão social. O documento é a **base de referência para o desenvolvimento**: descreve o que está implementado, o que está em construção e o que é futuro, para que cada requisito seja rastreável ao código e vice-versa.

### 1.2 Escopo

O Amparo é um assistente conversacional acessado via Telegram que recomenda atividades comunitárias locais, incentiva hábitos saudáveis e aproxima o usuário da rede de apoio. O sistema contempla:

- Cadastro e perfil do usuário (nome, cidade, bairro, interesses)
- Recomendação personalizada de atividades sociais e comunitárias
- Busca Web como camada de resiliência da base local
- Lembretes proativos via Telegram (V1.1)
- IA Proativa que identifica inatividade e incentiva participação social (V1.1)
- Conversação por texto (áudio previsto para V2)

Decisões de escopo relevantes: o módulo de **Missões Sociais foi eliminado por completo** (ver ADR-0001) e a exclusão de dados LGPD é prevista para V2.

### 1.3 Convenção de Status

Cada requisito funcional carrega um sufixo no código que indica seu estado de implementação:

| Sufixo | Significado |
|--------|-------------|
| (sem sufixo) | **Implementado** — existe no código e funciona |
| `-EC` | **Em construção** — previsto para o marco V1.1 |
| `-F` | **Futuro** — previsto para V2 ou além |

### 1.4 Definições, Acrônimos e Abreviações

| Termo | Definição |
|-------|-----------|
| Amparo | Nome do assistente conversacional |
| Telegram | Plataforma de mensagens utilizada como canal principal |
| IA | Inteligência Artificial |
| V1.1 | Marco atual de desenvolvimento (até fim de agosto/2026) |
| SRS | Software Requirements Specification (Especificação de Requisitos de Software) |
| LGPD | Lei Geral de Proteção de Dados (Lei nº 13.709/2018) |
| RF | Requisito Funcional |
| RNF | Requisito Não Funcional |
| CA | Critério de Aceitação |

### 1.5 Referências

- Documento de Visão: "Amparo – Plataforma de Envelhecimento Ativo e Inclusão Social.pdf" (2026)
- Telegram Bot API Documentation
- Lei Geral de Proteção de Dados — Lei nº 13.709/2018
- NBR ISO/IEC 9126 — Qualidade de Produto de Software
- `CONTEXT.md` (glossário do domínio) e `docs/adr/` (decisões de arquitetura)

### 1.6 Visão Geral do Documento

A Seção 2 apresenta a descrição geral do sistema. A Seção 3 detalha os requisitos funcionais com status. A Seção 4 descreve os requisitos não funcionais. A Seção 5 apresenta a modelagem. A Seção 6 especifica os requisitos de dados. A Seção 7 detalha as interfaces externas. A Seção 8 define o escopo do MVP. A Seção 9 apresenta o roadmap. A Seção 10 contém os apêndices.

---

## 2. Descrição Geral

### 2.1 Perspectiva do Produto

O Amparo é um sistema conversacional **standalone** utilizando o Telegram como canal primário de interação. Opera em modelo **cliente-servidor** com backend em nuvem (Vercel), utilizando APIs externas para:

- **Telegram Bot API** — envio e recebimento de mensagens
- **LLM (Large Language Model)** — processamento de linguagem natural e geração de respostas
- **Busca Web** — consulta em tempo real (SearXNG → Bing) quando a base local não atende

O sistema não substitui relações humanas, mas atua como um **facilitador** que conecta o idoso à sua comunidade.

### 2.2 Funções do Produto

1. **Cadastro e Perfil** — registrar nome, cidade, bairro e interesses do usuário
2. **Recomendação Personalizada** — sugerir atividades sociais, culturais e físicas com base no perfil
3. **Busca Web** — pesquisar atividades reais quando a base local não atende
4. **Lembretes Proativos** — enviar notificações sobre eventos e compromissos no horário configurado
5. **IA Proativa** — detectar inatividade e enviar incentivos personalizados
6. **Conversação Natural** — interação por texto em linguagem simples (áudio em V2)

### 2.3 Características dos Usuários

| Tipo de Usuário | Descrição | Nível de Experiência |
|----------------|-----------|---------------------|
| **Idoso (primário)** | Pessoa com 60+ anos, baixa familiaridade com tecnologia, usa Telegram no dia a dia | Básico (sabe enviar mensagens de texto e áudio) |
| **Cuidador/Familiar (secundário)** | Parente ou cuidador que auxilia o idoso, pode receber notificações de apoio (previsto para V4) | Intermediário |
| **Administrador do sistema** | Mantenedor técnico da plataforma, gerencia a base de atividades | Avançado |

### 2.4 Restrições

- A interface primária é o Telegram, limitando o design às capacidades da plataforma (texto, áudio, imagens, botões rápidos)
- O sistema deve processar mensagens em até 10 segundos para manter a fluidez da conversa
- Deve haver conformidade com a **LGPD** para tratamento de dados pessoais de idosos
- O MVP será implantado em ambiente **Vercel (serverless)** com escalabilidade horizontal
- A base de dados de atividades locais deve ser **curada manualmente** (sem raspagem automática até V3)

### 2.5 Suposições e Dependências

- O usuário possui um smartphone com Telegram instalado e conexão básica com internet
- Os provedores de LLM (OpenCode Zen, OpenRouter) manterão o nível gratuito disponível
- Parceiros institucionais (Sesc, prefeituras) fornecerão calendários de atividades em formato consumível

---

## 3. Requisitos Funcionais

> **Legenda de status:** sem sufixo = implementado · `-EC` = em construção (V1.1) · `-F` = futuro.

### 3.1 Módulo: Cadastro e Perfil do Usuário

| Código | Descrição | Prioridade |
|--------|-----------|------------|
| RF-001 | O sistema deve permitir que o usuário se cadastre informando nome, cidade e bairro | 🔴 Alta |
| RF-002 | O sistema deve permitir que o usuário selecione seus interesses (cultura, esporte, leitura, música, artesanato, voluntariado, etc.) | 🔴 Alta |
| RF-003-F | O sistema deve permitir que o usuário informe restrições de mobilidade ou saúde | 🟡 Média |
| RF-004-EC | O sistema deve armazenar as preferências de horário para envio de notificações | 🟡 Média |
| RF-005-F | O sistema deve permitir que o usuário atualize seu perfil a qualquer momento | 🔵 Baixa |
| RF-006-F | O sistema deve solicitar consentimento explícito do usuário para armazenar dados pessoais (LGPD) | 🔴 Alta |

### 3.2 Módulo: Recomendação de Atividades

| Código | Descrição | Prioridade |
|--------|-----------|------------|
| RF-007 | O sistema deve recomendar atividades comunitárias com base na cidade, bairro e interesses do usuário | 🔴 Alta |
| RF-008 | O sistema deve manter uma base de dados de atividades locais (Sesc, prefeituras, centros comunitários, bibliotecas, UBS) | 🔴 Alta |
| RF-009 | O sistema deve exibir para cada atividade: nome, data/horário, endereço, descrição e tipo | 🔴 Alta |
| RF-010-EC | Quando a base local não atender o pedido, o sistema deve buscar atividades na web automaticamente (fallback) | 🔴 Alta |
| RF-011-F | O sistema deve permitir que o usuário confirme interesse em uma atividade | 🟡 Média |
| RF-012-F | O sistema deve agrupar recomendações por categoria (cultura, saúde, lazer, educação, voluntariado) | 🟡 Média |
| RF-013-F | O sistema deve oferecer ajuda com inscrição na atividade quando solicitado | 🟡 Média |

### 3.3 Módulo: Lembretes Proativos

| Código | Descrição | Prioridade |
|--------|-----------|------------|
| RF-014-EC | O sistema deve enviar lembretes periódicos sobre atividades comunitárias relevantes | 🔴 Alta |
| RF-015-EC | O usuário deve poder configurar horários para receber notificações | 🟡 Média |
| RF-016-F | O sistema deve enviar lembretes de medicamentos, consultas e compromissos quando configurado | 🟡 Média |
| RF-017-F | O sistema deve reduzir a frequência de lembretes se o usuário ignorá-los repetidamente | 🔵 Baixa |

### 3.4 Módulo: IA Proativa

| Código | Descrição | Prioridade |
|--------|-----------|------------|
| RF-018-EC | O sistema deve enviar mensagem de incentivo quando detectar inatividade do usuário (3+ dias sem interação) | 🟡 Média |
| RF-019-F | A IA deve identificar padrões de redução de participação social do usuário | 🟡 Média |
| RF-020-F | A IA deve iniciar conversas proativas quando detectar redução de engajamento | 🟡 Média |
| RF-021 | A IA deve adaptar o tom e a abordagem com base no histórico de interações | 🔴 Alta |
| RF-022 | A IA deve responder perguntas sobre saúde, bem-estar e serviços públicos com informações gerais | 🟡 Média |
| RF-023 | O sistema deve registrar o histórico de conversas para personalização | 🔴 Alta |

### 3.5 Módulo: Conversação

| Código | Descrição | Prioridade |
|--------|-----------|------------|
| RF-024 | O sistema deve aceitar mensagens de **texto** como entrada principal | 🔴 Alta |
| RF-025-F | O sistema deve aceitar mensagens de **áudio** e transcrevê-las para processamento | 🟡 Média |
| RF-026 | O sistema deve responder em linguagem simples, acolhedora e em português brasileiro | 🔴 Alta |
| RF-027 | O sistema deve manter o contexto da conversa por sessão | 🔴 Alta |
| RF-028-F | O sistema deve oferecer botões rápidos para ações comuns (ex.: Atividades hoje) | 🟡 Média |
| RF-029-F | O sistema deve permitir que o usuário solicite ajuda a qualquer momento com o comando `/ajuda` | 🔵 Baixa |

---

## 4. Requisitos Não Funcionais

### 4.1 Usabilidade

| Código | Descrição | Critério de Aceitação | Prioridade |
|--------|-----------|----------------------|------------|
| RNF-001 | A interface deve usar linguagem simples, frases curtas e tom acolhedor | Nenhuma mensagem deve conter jargões técnicos; todas as respostas devem usar tratamento respeitoso (sr./sra.) | 🔴 Alta |
| RNF-002 | Mensagens de áudio devem ser suportadas como alternativa ao texto | O sistema deve transcrever áudios de até 2 minutos com precisão mínima de 80% | 🟡 Média |
| RNF-003 | O fluxo de cadastro deve ser concluído em no máximo 5 interações | Usuário completa cadastro respondendo a no máximo 5 perguntas | 🔴 Alta |
| RNF-004 | O sistema deve fornecer feedback imediato para cada ação do usuário | Toda ação do usuário deve receber uma resposta em até 3 segundos | 🔴 Alta |

### 4.2 Desempenho

| Código | Descrição | Critério de Aceitação | Prioridade |
|--------|-----------|----------------------|------------|
| RNF-005 | O sistema deve responder às mensagens em até 10 segundos | 95% das requisições devem ser processadas em ≤ 10s | 🟡 Média |
| RNF-006 | O sistema deve suportar até 50 usuários simultâneos no MVP | 50 requisições simultâneas não devem exceder 15s de resposta | 🟡 Média |
| RNF-007 | O sistema deve estar disponível 99% do tempo (downtime ≤ 7h/mês) | Uptime monitorado ≥ 99% | 🟡 Média |

### 4.3 Segurança

| Código | Descrição | Critério de Aceitação | Prioridade |
|--------|-----------|----------------------|------------|
| RNF-008 | Dados pessoais do usuário devem ser armazenados com criptografia em repouso | AES-256 para dados sensíveis em banco de dados | 🔴 Alta |
| RNF-009 | O sistema deve estar em conformidade com a LGPD | Implementar: consentimento explícito, direito de exclusão, política de privacidade acessível | 🔴 Alta |
| RNF-010 | Chaves de API e credenciais não devem ser expostas no código-fonte | Uso exclusivo de variáveis de ambiente | 🔴 Alta |
| RNF-011-F | O usuário deve poder solicitar a exclusão de todos os seus dados (V2) | Implementar comando ou fluxo de exclusão de conta | 🟡 Média |

### 4.4 Confiabilidade

| Código | Descrição | Critério de Aceitação | Prioridade |
|--------|-----------|----------------------|------------|
| RNF-012 | Em caso de falha do provedor LLM principal, o sistema deve tentar fallback automaticamente | Até 2 tentativas com provedores diferentes antes de retornar erro | 🔴 Alta |
| RNF-013 | O sistema não deve perder mensagens do usuário em caso de falha temporária | Mensagens não processadas devem ser retidas na fila por até 24h | 🟡 Média |
| RNF-014 | O sistema deve registrar logs para diagnóstico de erros | Logs com timestamp, componente, severidade e mensagem de erro | 🟡 Média |

### 4.5 Manutenibilidade

| Código | Descrição | Critério de Aceitação | Prioridade |
|--------|-----------|----------------------|------------|
| RNF-015 | O código-fonte deve ser versionado com Git e GitHub | Commits semânticos, branch main protegida | 🔵 Baixa |
| RNF-016 | A base de atividades deve ser atualizável sem deploy do sistema principal | Arquivo JSON como fonte de dados, um por cidade | 🟡 Média |
| RNF-017-EC | A base de atividades deve ser mantida com dados atuais | Atividades com `data_hora` no passado devem ser removidas ou atualizadas na revisão da base | 🟡 Média |

---

## 5. Diagramas e Modelagem

### 5.1 Arquitetura do Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                         USUÁRIO IDOSO                           │
│                     (Telegram no smartphone)                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    ┌──────┴──────┐
                    │  Telegram   │
                    │  Bot API    │  ← Webhook HTTP
                    └──────┬──────┘
                           │
┌──────────────────────────┴──────────────────────────────────────┐
│                     VERCEL (Serverless)                         │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              API Gateway (webhook.js)                    │   │
│  │  Recebe update do Telegram → roteia → retorna resposta   │   │
│  └────────┬──────────────────────────────────┬─────────────┘   │
│           │                                  │                 │
│  ┌────────┴────────┐           ┌─────────────┴───────────┐    │
│  │  Conversation   │           │       Telegram          │    │
│  │  Manager        │           │       Sender            │    │
│  │  (sessão/ctx)   │           │  (envia msg resposta)   │    │
│  └────────┬────────┘           └─────────────────────────┘    │
│           │                                                  │
│  ┌────────┴─────────────────────────────────────────────┐    │
│  │              LLM Gateway (llm.js)                     │    │
│  │  OpenCode Zen (DeepSeek) → OpenRouter (Llama)         │    │
│  │  Fallback automático em caso de erro/rate limit       │    │
│  └────────┬─────────────────────────────────────────────┘    │
│           │                                                  │
│  ┌────────┴─────────────────────────────────────────────┐    │
│  │         Activity Engine / Recommender                │    │
│  │  Consulta base → filtra por cidade/bairro/interesses │    │
│  │  → fallback para Busca Web quando necessário         │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
     ┌────────┴────────┐     ┌──────────┴──────────┐
     │   PostgreSQL    │     │     Busca Web        │
     │  (sessions:     │     │  SearXNG → Bing      │
     │   perfil +      │     │  (fallback da base   │
     │   histórico)    │     │   local)             │
     └─────────────────┘     └─────────────────────┘
```

### 5.2 Fluxo de Interação Principal

```
IDOSO                        AMPARO (IA)
  │                              │
  │  1. Envia "Oi" no Telegram   │
  │ ──────────────────────────►  │
  │                              │
  │  2. "Olá! 🌻 Sou o Amparo,   │
  │     seu assistente de        │
  │     bem-estar. Qual seu      │
  │     nome e onde você mora?"  │
  │ ◄────────────────────────── │
  │                              │
  │  3. "Meu nome é Maria,       │
  │     moro no Centro"          │
  │ ──────────────────────────►  │
  │                              │
  │  4. "Que bom, Maria! Vou     │
  │     anotar. Quais atividades │
  │     você mais gosta?         │
  │     [Cultura] [Esporte]      │
  │     [Leitura] [Voluntariado]"│
  │ ◄────────────────────────── │
  │                              │
  │  5. [Seleciona "Cultura"]    │
  │ ──────────────────────────►  │
  │                              │
  │  6. "Ótimo! Aqui estão       │
  │     atividades perto de vc:  │
  │     ▶ Oficina de pintura     │
  │       - Sesc Centro, 3ªf 14h │
  │       Quer saber mais?"      │
  │ ◄────────────────────────── │
```

### 5.3 Fluxo de IA Proativa

```
  AMPARO (IA)                   IDOSO
       │                            │
       │  1. [3+ dias sem           │
       │     interação]             │
       │     "Saudades, sra. Maria! │
       │     🌻 Como estão as       │
       │     coisas? Quer ver as    │
       │     atividades da semana?" │
       │ ────────────────────────►  │
       │                            │
       │  2. "Que bom ouvir você!   │
       │     Tem oficina de pintura │
       │     amanhã às 14h no Sesc. │
       │     Que acha?"             │
       │ ◄──────────────────────── │
       │                            │
       │  3. "Maravilha, sra.       │
       │     Maria! 🎉 Anotei sua   │
       │     preferência."          │
       │ ────────────────────────►  │
```

---

## 6. Requisitos de Dados

### 6.1 Persistência

O MVP persiste uma **sessão por usuário** em PostgreSQL (tabela `sessions` com JSONB), contendo perfil e histórico de conversa. Sem `DATABASE_URL`, o sistema opera com memória volátil (apenas desenvolvimento).

```sql
CREATE TABLE sessions (
    chat_id     TEXT PRIMARY KEY,
    data        JSONB NOT NULL,   -- { user: {nome, cidade, bairro, interesses}, history: [...] }
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 6.2 Base de Atividades

Catálogo curado em arquivos `data/atividades-<cidade>.json` (um por cidade), carregados sem deploy.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | number | Identificador |
| `nome` | string | Nome da atividade |
| `descricao` | string | Descrição |
| `categoria` | string | cultura, esporte, educacao, saude, lazer, voluntariado |
| `tipo` | string | oficina, evento, curso, grupo, servico |
| `data_hora` | ISO datetime | Data e horário |
| `endereco` | string | Endereço |
| `bairro` | string | Bairro |
| `cidade` | string | Cidade |
| `parceiro` | string | Sesc, Prefeitura, Biblioteca, UBS, etc. |
| `contato` | string | Telefone/contato |
| `link_inscricao` | string | URL de inscrição |

### 6.3 Dicionário de Dados

| Entidade | Descrição | Volume Estimado (MVP) |
|----------|-----------|----------------------|
| `sessions` | Perfil + histórico por usuário (PostgreSQL ou memória) | Até 100 usuários |
| `atividades-*.json` | Catálogo de atividades comunitárias curado por cidade | Até 200 registros |
| `conversas` | Histórico de interações com a IA (planejado para personalização avançada em V2) | Até 5.000/mês |

---

## 7. Requisitos de Interface Externa

### 7.1 Interface com o Usuário (Telegram)

| Aspecto | Especificação |
|---------|---------------|
| Canal primário | Telegram via Telegram Bot API |
| Formato de entrada | Texto (obrigatório); Áudio e botões (V2) |
| Formato de saída | Texto com formatação simples; botões de resposta (V2) |
| Tratamento | Linguagem simples, frases curtas, tom acolhedor, tratamento "sr./sra." |

### 7.2 Interface com Provedores de IA

| Provedor | Endpoint | Autenticação | Modelo |
|----------|----------|-------------|--------|
| OpenCode Zen | `POST https://opencode.ai/zen/v1/chat/completions` | Bearer Token | `deepseek-v4-flash-free` |
| OpenRouter (fallback) | `POST https://openrouter.ai/api/v1/chat/completions` | Bearer Token | `meta-llama/llama-3.3-70b-instruct:free` |

### 7.3 Interface com Busca Web

| Provedor | Endpoint | Autenticação | Uso |
|----------|----------|-------------|-----|
| SearXNG (primário) | `GET {SEARXNG_URL}/search?q=...&format=json` | Bearer (se configurado) | Busca em tempo real |
| Bing (fallback) | `GET https://api.bing.microsoft.com/v7.0/search` | `Ocp-Apim-Subscription-Key` | Fallback quando SearXNG falha |

### 7.4 Interface com Telegram Bot API

| Operação | Endpoint | Descrição |
|----------|----------|-----------|
| Enviar texto | `POST https://api.telegram.org/bot{token}/sendMessage` | Envio de respostas ao usuário |
| Receber mensagem | Webhook configurado via `setWebhook` | Recebimento de mensagens do usuário |

---

## 8. MVP — Produto Mínimo Viável

### 8.1 Escopo do MVP

| Módulo | Funcionalidades incluídas | Status |
|--------|--------------------------|--------|
| **Cadastro** | Nome, cidade, bairro, interesses | 🔴 Implementado |
| **Conversação** | Texto, histórico de sessão, resposta em linguagem simples | 🔴 Implementado |
| **Recomendação** | Base curada, filtro por cidade/bairro/interesses | 🔴 Implementado |
| **Busca Web** | Fallback automático quando a base local não atende | 🟡 V1.1 (em construção) |
| **Lembretes** | Notificações de atividades no horário configurado | 🟡 V1.1 (em construção) |
| **IA Proativa** | Incentivo após 3+ dias de inatividade | 🟡 V1.1 (em construção) |

### 8.2 O que NÃO está no MVP

| Funcionalidade | Motivo | Versão prevista |
|---------------|--------|-----------------|
| Transcrição de áudio | Complexidade adicional de integração com STT | V2 |
| Botões interativos do Telegram | Requer implementação de inline keyboards | V2 |
| Exclusão de dados (LGPD) | Fluxo de exclusão de conta | V2 |
| **Missões Sociais** | **Módulo eliminado do produto (ADR-0001)** | — |
| Integração automática com calendários públicos | Depende de API de prefeituras e parceiros | V3 |
| Painel administrativo | Não necessário para validação com usuários | V4 |
| Expansão para múltiplas cidades | MVP focado em uma cidade-piloto (Santo André) | V4 |

### 8.3 Critérios de Aceitação do MVP

| Código | Critério | Tipo |
|--------|----------|------|
| C-01 | Usuário completa cadastro em até 5 interações pelo Telegram | Funcional |
| C-02 | Sistema recomenda ao menos 3 atividades relevantes para o perfil do usuário | Funcional |
| C-03 | Quando a base local não atende, o sistema busca atividades na web e apresenta resultados | Funcional |
| C-04 | Lembretes são enviados no horário configurado pelo usuário | Funcional |
| C-05 | Sistema envia mensagem de incentivo após 3+ dias de inatividade | Funcional |
| C-06 | Sistema responde 95% das mensagens em até 10 segundos | Desempenho |
| C-07 | Fallback para OpenRouter quando OpenCode Zen falha | Confiabilidade |
| C-08 | Dados do usuário são armazenados somente após consentimento explícito | Segurança |
| C-09 | Mensagens usam linguagem simples, sem jargões técnicos | Usabilidade |
| C-10 | Sistema mantém histórico da conversa por sessão | Funcional |

---

## 9. Roadmap

```
V1 ─ MVP (entregue — Julho 2026)
  ├── Cadastro + Perfil (nome, cidade, bairro, interesses)
  ├── Recomendação de atividades (base curada)
  ├── Busca Web manual (marcador [[BUSCAR:]])
  ├── Conversação texto (LLM com fallback)
  └── Telegram como canal único

V1.1 ─ Fechar gaps (até fim de Agosto 2026)
  ├── Lembretes proativos (Vercel Cron)
  ├── IA Proativa (incentivo por inatividade)
  ├── Fallback automático recomendação → Busca Web
  └── Preferência de horário de notificações

V2 ─ IA Personalizada (Setembro 2026)
  ├── Transcrição de áudio (STT)
  ├── Botões interativos Telegram
  ├── Exclusão de dados e consentimento LGPD
  ├── Perfil mais completo (restrições, preferências)
  └── Histórico e personalização avançada

V3 ─ Integração com Calendários Públicos (Outubro 2026+)
  ├── Raspagem automática de calendários culturais
  ├── Suporte a múltiplos canais
  └── Dashboard de atividades para administradores

V4 ─ Escala
  ├── Expansão para novas cidades
  ├── Painel institucional para parceiros
  ├── Envolvimento de familiares/cuidadores
  └── Métricas de impacto social
```

---

## 10. Apêndices

### 10.1 Rastreabilidade Requisitos × Objetivos

| Objetivo | RFs Relacionados |
|----------|------------------|
| Reduzir o isolamento social de pessoas idosas | RF-007, RF-010, RF-014, RF-018 |
| Reduzir carga cognitiva no uso de tecnologia | RF-024, RF-026, RNF-001 |
| Memorizar preferências do usuário | RF-001, RF-002, RF-023 |
| Promover autonomia digital e social | RF-007, RF-013, RF-022 |
| Envolver familiares e cuidadores | (previsto para V4) |

### 10.2 Glossário

| Termo | Definição |
|-------|-----------|
| Amparo | Assistente conversacional para idosos |
| Atividade | Evento comunitário curado (oficina, curso, grupo, serviço) |
| Bairro | Divisão geográfica usada para filtrar atividades locais |
| Base de Atividades | Catálogo curado por cidade (`data/atividades-<cidade>.json`) |
| Busca Web | Consulta em tempo real (SearXNG → Bing) usada quando a base local não atende |
| Envelhecimento Ativo | Conceito da OMS: processo de otimizar oportunidades de saúde, participação e segurança |
| IA Proativa | Comportamento do sistema de iniciar conversa quando detecta inatividade |
| Isolamento Social | Ausência de contato ou interação com a comunidade |
| Lembrete Proativo | Mensagem enviada pelo sistema em horário configurado |
| LGPD | Lei Geral de Proteção de Dados Pessoais (Brasil) |
| LLM | Large Language Model (Modelo de Linguagem de Grande Escala) |
| Parceiro | Instituição que fornece atividades à Base (Sesc, prefeituras, etc.) |
| Provedor LLM | Serviço de API que fornece acesso a modelos de IA |
| Sessão | Estado persistido por usuário (perfil + histórico) |
| Usuário | Pessoa idosa (60+) que interage com o Amparo |

### 10.3 Prompt do Sistema (LLM)

```markdown
# IDENTIDADE

Você é o **Amparo**, um assistente de bem-estar digital criado especialmente 
para pessoas idosas. Sua missão é combater o isolamento social conectando o 
usuário a atividades comunitárias, culturais e sociais perto da casa dele. 

Você não é um robô frio — você é um **companheiro virtual**, paciente, 
caloroso e respeitoso, como um neto ou neta que ajuda com carinho.

---

# PERSONA

- **Nome:** Amparo
- **Tom:** Caloroso, paciente, respeitoso, otimista
- **Tratamento:** Use sempre "sr." ou "sra." + primeiro nome da pessoa
- **Estilo:** Frases curtas, linguagem simples, sem gírias, sem termos técnicos
- **Limite de resposta:** No máximo **2 parágrafos curtos** por mensagem
- **Idioma:** Português brasileiro (evite estrangeirismos)

---

# REGRAS OBRIGATÓRIAS

## Tom e Linguagem
1. Seja **caloroso** — use emojis com moderação 🌻😊🎉🌟 (máx. 1 por parágrafo)
2. Seja **paciente** — o usuário pode demorar, repetir perguntas ou se confundir
3. Seja **simples** — frases de até 20 palavras. Parágrafos de no máximo 3 frases
4. Seja **respeitoso** — use "sr." ou "sra." + nome (ex: "sr. José", "sra. Maria")
5. NUNCA use: jargões técnicos ("API", "servidor", "token", "banco de dados", "bug")
6. NUNCA use: palavras em inglês sem tradução ("download", "upload", "login", "OK")
7. NUNCA peça: CPF completo, número de cartão de crédito, senhas bancárias
8. NUNCA compartilhe: dados pessoais do usuário com terceiros

## Formatação das Respostas
9. **Sempre comece** cumprimentando ou retomando o contexto ("Entendi, sra. Maria!")
10. **Máximo 2 parágrafos** por resposta. Se precisar de mais info, pergunte aos poucos
11. **Quebre informações longas** em bullet points simples (•), máximo 4 por resposta
12. **Ao recomendar atividade**, sempre inclua:
    - Nome da atividade
    - Endereço (ou ponto de referência conhecido)
    - Data e horário (em formato "terça-feira, 14h")
    - Frase de incentivo ("Que tal ir?")
13. **Confirme** que entendeu antes de agir ("Então quer dizer que você gosta de...")

## Fluxo de Cadastro (primeiro contato)
14. Ao receber "Oi", "Olá", "Bom dia" ou "/start":
    - Seja breve. Apresente-se em 1 parágrafo
    - Faça UMA pergunta por vez (não sobrecarregue)
    - Ordem das perguntas: ❶ Nome → ❷ Cidade → ❸ Bairro → ❹ Interesses (lista de opções)
15. Após o cadastro, já sugira UMA atividade disponível na região

## Engajamento e IA Proativa
16. Se o usuário sumir por 3+ dias sem interagir, envie uma mensagem curta e acolhedora:
    "Saudades, sra. Maria! 🌻 Como estão as coisas? Quer ver as atividades da semana?"
17. Ao responder sobre atividades, prefira recomendar da base local; se o usuário 
    pedir algo que a base não tem, use a ferramenta de busca.

## Tratamento de Erros
18. Se não entender a mensagem, peça desculpas e peça para repetir de forma mais simples
19. Se o usuário estiver irritado ou frustrado, acolha e ofereça ajuda prática
20. Se perguntar algo fora do escopo (política, religião, saúde grave), diga que não sabe 
    e sugira procurar um profissional ou serviço especializado
21. Se perguntar sobre preços ou compras: "No momento estou focado em atividades sociais. 
    Quer que eu busque uma oficina ou evento perto de você?"

---

# EXEMPLOS DE DIÁLOGO

## Cadastro
USUÁRIO: Oi
AMPARO: Olá! 🌻 Sou o Amparo, seu assistente de bem-estar. 
Como posso chamar você?

USUÁRIO: Maria
AMPARO: Que nome lindo, sra. Maria! E onde a sra. mora? 
Qual bairro de Santo André?

## Recomendação
USUÁRIO: O que tem pra fazer hoje?
AMPARO: Hoje tem oficina de pintura no Sesc Santo André, 
às 14h — Rua Tamarutaca, 302. Fica perto do Parque Celso 
Daniel. A sra. gosta de pintura? 🎨

## IA Proativa
AMPARO: Sra. Maria, faz um tempinho que não conversamos! 
Amanhã tem sessão de leitura na Biblioteca Municipal às 10h. 
A sra. quer ir? 📚

---

# FERRAMENTAS DISPONÍVEIS

Estas funções você pode chamar automaticamente quando 
detectar a intenção correta:

| Intenção | Ferramenta | Descrição |
|----------|-----------|-----------|
| Usuário quer ver atividades | `recomendar_atividades(cidade, bairro, interesses)` | Retorna lista de atividades filtradas; se a base local não atender, faz busca na web |
| Usuário informa dados pessoais | `salvar_perfil(nome, cidade, bairro, interesses)` | Salva o cadastro do usuário |
| Usuário pede algo que a base não tem | `buscar_online(termo)` | Pesquisa atividades na web (SearXNG → Bing) |
```

---

**© 2026 — Projeto Amparo**  
Documento de Especificação de Requisitos de Software