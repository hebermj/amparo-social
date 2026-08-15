# Documento de Especificação de Requisitos de Software (SRS)

## Amparo — Plataforma de Envelhecimento Ativo e Inclusão Social

**Versão:** 1.0  
**Data:** Julho de 2026  
**Autor:** Heber  

---

## 1. Introdução

### 1.1 Finalidade

Este documento tem por finalidade especificar os requisitos de software do **Amparo**, uma plataforma conversacional via Telegram que utiliza inteligência artificial para combater o isolamento social da população idosa, promovendo envelhecimento ativo, autonomia e inclusão social. O documento destina-se à equipe de desenvolvimento, stakeholders e avaliadores acadêmicos.

### 1.2 Escopo

O Amparo é um assistente conversacional acessado via Telegram — ferramenta que já faz parte da rotina da maioria dos idosos brasileiros — que atua como facilitador da autonomia, recomendando atividades comunitárias, incentivando hábitos saudáveis, lembrando compromissos e aproximando o usuário da rede de apoio local. O sistema contempla:

- Cadastro e perfil do usuário (interesses, região, preferências)
- Recomendação personalizada de atividades sociais e comunitárias
- Sistema de lembretes proativos via Telegram
- Missões Sociais com acompanhamento de participação
- Conversação por texto e áudio
- IA Proativa que identifica padrões de comportamento e incentiva participação social
- Integração com bases de dados de atividades locais (Sesc, prefeituras, centros comunitários)

Este documento cobre o desenvolvimento do **MVP (Minimum Viable Product)** e as versões futuras do roadmap.

### 1.3 Definições, Acrônimos e Abreviações

| Termo | Definição |
|-------|-----------|
| Amparo | Nome do assistente conversacional |
| Telegram | Plataforma de mensagens utilizada como canal principal |
| IA | Inteligência Artificial |
| MVP | Minimum Viable Product (Produto Mínimo Viável) |
| SRS | Software Requirements Specification (Especificação de Requisitos de Software) |
| Missão Social | Desafio semanal que estimula interação social |
| LGPD | Lei Geral de Proteção de Dados (Lei nº 13.709/2018) |
| RF | Requisito Funcional |
| RNF | Requisito Não Funcional |
| UC | Caso de Uso (Use Case) |
| CA | Critério de Aceitação |

### 1.4 Referências

- Documento de Visão: "Amparo – Plataforma de Envelhecimento Ativo e Inclusão Social.pdf" (2026)
- Telegram Bot API Documentation
- Lei Geral de Proteção de Dados — Lei nº 13.709/2018
- NBR ISO/IEC 9126 — Qualidade de Produto de Software

### 1.5 Visão Geral do Documento

A Seção 2 apresenta a descrição geral do sistema. A Seção 3 detalha os requisitos funcionais. A Seção 4 descreve os requisitos não funcionais. A Seção 5 apresenta a modelagem e diagramas. A Seção 6 especifica os requisitos de dados. A Seção 7 detalha as interfaces externas. A Seção 8 define o escopo do MVP. A Seção 9 apresenta o roadmap de evolução. A Seção 10 contém os apêndices.

---

## 2. Descrição Geral

### 2.1 Perspectiva do Produto

O Amparo é um sistema conversacional **standalone** utilizando o Telegram como canal primário de interação. O sistema opera em modelo **cliente-servidor** com backend em nuvem (Vercel), utilizando APIs externas para:

- **Telegram Bot API** — envio e recebimento de mensagens
- **LLM (Large Language Model)** — processamento de linguagem natural e geração de respostas
- **Base de dados externa** — consulta a calendários culturais e atividades comunitárias

O sistema não substitui relações humanas, mas atua como um **facilitador** que conecta o idoso à sua comunidade.

### 2.2 Funções do Produto

As principais funções do sistema são:

1. **Cadastro e Perfil** — registrar interesses, região, dados de saúde e preferências do usuário
2. **Recomendação Personalizada** — sugerir atividades sociais, culturais e físicas com base no perfil
3. **Lembretes Proativos** — enviar notificações sobre eventos, medicamentos, consultas e compromissos
4. **Missões Sociais** — propor desafios semanais de participação comunitária
5. **Missões Sociais** — propor desafios semanais de participação comunitária
6. **Conversação Natural** — interação por texto e áudio em linguagem simples
7. **IA Proativa** — monitoramento de engajamento com incentivos personalizados
8. **Compras Assistidas** (versões futuras) — auxílio na compra de itens essenciais

### 2.3 Características dos Usuários

| Tipo de Usuário | Descrição | Nível de Experiência |
|----------------|-----------|---------------------|
| **Idoso (primário)** | Pessoa com 60+ anos, baixa familiaridade com tecnologia, usa Telegram no dia a dia | Básico (sabe enviar mensagens de texto e áudio) |
| **Cuidador/Familiar (secundário)** | Parente ou cuidador que auxilia o idoso, pode receber notificações de apoio | Intermediário |
| **Administrador do sistema** | Mantenedor técnico da plataforma, gerencia parcerias e base de atividades | Avançado |

### 2.4 Restrições

- A interface primária é o Telegram, limitando o design às capacidades da plataforma (texto, áudio, imagens, botões rápidos)
- O sistema deve processar mensagens em até 10 segundos para manter a fluidez da conversa
- Deve haver conformidade com a **LGPD** para tratamento de dados pessoais de idosos
- O MVP será implantado em ambiente **Vercel (serverless)** com escalabilidade horizontal
- A base de dados de atividades locais deve ser **curada manualmente** no MVP (sem raspagem automática)

### 2.5 Suposições e Dependências

- O usuário possui um smartphone com Telegram instalado e conexão básica com internet
- Os provedores de LLM (OpenCode Zen, OpenRouter) manterão o nível gratuito disponível
- Parceiros institucionais (Sesc, prefeituras) fornecerão calendários de atividades em formato consumível

---

## 3. Requisitos Funcionais

### 3.1 Módulo: Cadastro e Perfil do Usuário

| Código | Descrição | Prioridade |
|--------|-----------|------------|
| RF-001 | O sistema deve permitir que o usuário se cadastre informando nome, bairro/região e data de nascimento | 🔴 Alta |
| RF-002 | O sistema deve permitir que o usuário selecione seus interesses (cultura, esporte, leitura, música, artesanato, voluntariado, etc.) | 🔴 Alta |
| RF-003 | O sistema deve permitir que o usuário informe restrições de mobilidade ou saúde | 🟡 Média |
| RF-004 | O sistema deve armazenar as preferências de horário para envio de notificações | 🟡 Média |
| RF-005 | O sistema deve permitir que o usuário atualize seu perfil a qualquer momento | 🔵 Baixa |
| RF-006 | O sistema deve solicitar consentimento explícito do usuário para armazenar dados pessoais (LGPD) | 🔴 Alta |

### 3.2 Módulo: Recomendação de Atividades

| Código | Descrição | Prioridade |
|--------|-----------|------------|
| RF-007 | O sistema deve recomendar atividades comunitárias com base na região e interesses do usuário | 🔴 Alta |
| RF-008 | O sistema deve manter uma base de dados de atividades locais (Sesc, prefeituras, centros comunitários, bibliotecas, UBS) | 🔴 Alta |
| RF-009 | O sistema deve exibir para cada atividade: nome, data/horário, endereço, descrição e tipo | 🔴 Alta |
| RF-010 | O sistema deve permitir que o usuário confirme interesse em uma atividade | 🟡 Média |
| RF-011 | O sistema deve agrupar recomendações por categoria (cultura, saúde, lazer, educação, voluntariado) | 🟡 Média |
| RF-012 | O sistema deve oferecer ajuda com inscrição na atividade quando solicitado | 🟡 Média |

### 3.3 Módulo: Lembretes Proativos

| Código | Descrição | Prioridade |
|--------|-----------|------------|
| RF-013 | O sistema deve enviar lembretes periódicos sobre atividades comunitárias relevantes | 🔴 Alta |
| RF-014 | O sistema deve enviar lembretes de medicamentos, consultas e compromissos quando configurado | 🟡 Média |
| RF-015 | O sistema deve enviar mensagens de incentivo matinais ou semanais personalizadas | 🔵 Baixa |
| RF-016 | O usuário deve poder configurar horários para receber notificações | 🟡 Média |
| RF-017 | O sistema deve reduzir a frequência de lembretes se o usuário ignorá-los repetidamente | 🔵 Baixa |

### 3.4 Módulo: Missões Sociais

| Código | Descrição | Prioridade |
|--------|-----------|------------|
| RF-018 | O sistema deve propor uma Missão Social semanal personalizada ao usuário | 🟡 Média |
| RF-019 | O sistema deve permitir que o usuário confirme a realização de uma missão (via texto, áudio ou foto) | 🟡 Média |
| RF-021 | O sistema deve registrar as missões realizadas pelo usuário | 🔵 Baixa |
| RF-023 | O sistema deve enviar mensagem de reconhecimento e incentivo ao completar uma missão | 🟡 Média |
| RF-024 | O sistema deve notificar o usuário sobre novas missões disponíveis | 🟡 Média |

### 3.5 Módulo: IA Proativa

| Código | Descrição | Prioridade |
|--------|-----------|------------|
| RF-025 | A IA deve identificar padrões de redução de participação social do usuário | 🟡 Média |
| RF-026 | A IA deve iniciar conversas proativas quando detectar redução de engajamento | 🟡 Média |
| RF-027 | A IA deve adaptar o tom e a abordagem com base no histórico de interações | 🔴 Alta |
| RF-028 | A IA deve responder perguntas sobre saúde, bem-estar e serviços públicos com informações gerais | 🟡 Média |
| RF-029 | A IA deve registrar o histórico de conversas para personalização (com consentimento) | 🔴 Alta |

### 3.6 Módulo: Conversação

| Código | Descrição | Prioridade |
|--------|-----------|------------|
| RF-030 | O sistema deve aceitar mensagens de **texto** como entrada principal | 🔴 Alta |
| RF-031 | O sistema deve aceitar mensagens de **áudio** e transcrevê-las para processamento | 🟡 Média |
| RF-032 | O sistema deve responder em linguagem simples, acolhedora e em português brasileiro | 🔴 Alta |
| RF-033 | O sistema deve manter o contexto da conversa por sessão | 🔴 Alta |
| RF-034 | O sistema deve oferecer botões rápidos para ações comuns (Ver missão, Atividades hoje) | 🟡 Média |
| RF-035 | O sistema deve permitir que o usuário solicite ajuda a qualquer momento com o comando `/ajuda` | 🔵 Baixa |

---

## 4. Requisitos Não Funcionais

### 4.1 Usabilidade

| Código | Descrição | Critério de Aceitação | Prioridade |
|--------|-----------|----------------------|------------|
| RNF-001 | A interface deve usar linguagem simples, frases curtas e tom acolhedor | Nenhuma mensagem deve conter jargões técnicos; todas as respostas devem usar tratamento respeitoso (sr./sra.) | 🔴 Alta |
| RNF-002 | Mensagens de áudio devem ser suportadas como alternativa ao texto | O sistema deve transcrever áudios de até 2 minutos com precisão mínima de 80% | 🟡 Média |
| RNF-003 | O fluxo de cadastro deve ser concluído em no máximo 5 interações | Usuário completa cadastro respondendo a no máximo 5 perguntas | 🔴 Alta |
| RNF-004 | O sistema deve fornecer feedback visual/ textual imediato para cada ação do usuário | Toda ação do usuário deve receber uma resposta em até 3 segundos | 🔴 Alta |

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
| RNF-009 | O sistema deve estar em conformidade com a LGPD (Lei nº 13.709/2018) | Implementar: consentimento explícito, direito de exclusão, política de privacidade acessível | 🔴 Alta |
| RNF-010 | Chaves de API e credenciais não devem ser expostas no código-fonte | Uso exclusivo de variáveis de ambiente | 🔴 Alta |
| RNF-011 | O usuário deve poder solicitar a exclusão de todos os seus dados | Implementar comando ou fluxo de exclusão de conta | 🟡 Média |

### 4.4 Confiabilidade

| Código | Descrição | Critério de Aceitação | Prioridade |
|--------|-----------|----------------------|------------|
| RNF-012 | Em caso de falha do provedor LLM principal, o sistema deve tentar fallback automaticamente | Até 3 tentativas com provedores diferentes antes de retornar erro | 🔴 Alta |
| RNF-013 | O sistema não deve perder mensagens do usuário em caso de falha temporária | Mensagens não processadas devem ser retidas na fila por até 24h | 🟡 Média |
| RNF-014 | O sistema deve registrar logs para diagnóstico de erros | Logs com timestamp, componente, severidade e mensagem de erro | 🟡 Média |

### 4.5 Manutenibilidade

| Código | Descrição | Critério de Aceitação | Prioridade |
|--------|-----------|----------------------|------------|
| RNF-015 | O código-fonte deve ser versionado com Git e GitHub | Commits semânticos, branch main protegida | 🔵 Baixa |
| RNF-016 | A base de atividades deve ser atualizável sem deploy do sistema principal | Arquivo JSON ou planilha externa como fonte de dados | 🟡 Média |

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
│  │  Consulta base → filtra por região/interesses →       │    │
│  │  gera recomendação personalizada                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │                         │
     ┌────────┴────────┐     ┌──────────┴──────────┐
     │   PostgreSQL    │     │  Base de Atividades  │
     │  (usuários,     │     │  (JSON / Planilha)   │
     │   (usuários,     │     │  Sesc, Prefeitura,   │
     │                 │     │  Centros, Parceiros  │
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

### 5.3 Fluxo de Missão Social

```
  IA PROATIVA                   IDOSO
       │                            │
       │  1. "Maria, sua missão     │
       │     desta semana:          │
       │     Visitar a Biblioteca   │
       │     Municipal - Rua X, 123 │
       │     Que acha?"             │
       │ ────────────────────────►  │
       │                            │
       │  2. "Que legal! Vou sim!"  │
       │ ◄──────────────────────── │
       │                            │
       │  3. "Maravilha! 🌟 Mande   │
       │     uma foto ou áudio      │
       │     quando chegar lá."     │
       │ ────────────────────────►  │
       │                            │
       │  4. [Envia foto]           │
       │ ◄──────────────────────── │
       │                            │
       │  5. "Parabéns, Maria! 🎉   │
       │     Que bom que você foi!  │
       │     Continue assim!"       │
       │ ────────────────────────►  │
```

---

## 6. Requisitos de Dados

### 6.1 Entidades do Banco de Dados

```sql
-- ── Usuários ──────────────────────────────────────────────
CREATE TABLE usuarios (
    id              SERIAL PRIMARY KEY,
    telefone        VARCHAR(20) UNIQUE NOT NULL,
    nome            VARCHAR(100) NOT NULL,
    bairro          VARCHAR(100) NOT NULL,
    cidade          VARCHAR(100) NOT NULL DEFAULT 'Santo André',
    data_nascimento DATE,
    interesses      TEXT[],       -- Array de interesses ['cultura','esporte','leitura']
    restricoes      TEXT,         -- Restrições de mobilidade/saúde
    pref_horario    TIME,         -- Horário preferido para notificações
    lgpd_consentido BOOLEAN DEFAULT FALSE,
    ativo           BOOLEAN DEFAULT TRUE,
    criado_em       TIMESTAMP DEFAULT NOW(),
    atualizado_em   TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_usuarios_telefone ON usuarios(telefone);
CREATE INDEX idx_usuarios_bairro ON usuarios(bairro);

-- ── Atividades ────────────────────────────────────────────
CREATE TABLE atividades (
    id              SERIAL PRIMARY KEY,
    nome            VARCHAR(200) NOT NULL,
    descricao       TEXT,
    categoria       VARCHAR(50) NOT NULL,  -- 'cultura','esporte','saude','educacao','lazer','voluntariado'
    tipo            VARCHAR(50),            -- 'oficina','evento','curso','grupo','servico'
    data_hora       TIMESTAMP,
    endereco        VARCHAR(300),
    bairro          VARCHAR(100),
    cidade          VARCHAR(100) DEFAULT 'Santo André',
    parceiro        VARCHAR(100),           -- 'Sesc','Prefeitura','Biblioteca','UBS',etc
    contato         VARCHAR(100),
    link_inscricao  VARCHAR(300),
    ativo           BOOLEAN DEFAULT TRUE,
    criado_em       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_atividades_bairro ON atividades(bairro);
CREATE INDEX idx_atividades_categoria ON atividades(categoria);
CREATE INDEX idx_atividades_data ON atividades(data_hora);

-- ── Missões Sociais ───────────────────────────────────────
CREATE TABLE missoes (
    id              SERIAL PRIMARY KEY,
    usuario_id      INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    atividade_id    INTEGER REFERENCES atividades(id),
    titulo          VARCHAR(200) NOT NULL,
    descricao       TEXT,
    data_inicio     DATE DEFAULT CURRENT_DATE,
    data_fim        DATE,
    status          VARCHAR(20) DEFAULT 'pendente',  -- 'pendente','concluida','expirada'
    confirmacao     TEXT,         -- URL da foto ou transcrição do áudio
    concluida_em    TIMESTAMP,
    criado_em       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_missoes_usuario ON missoes(usuario_id);
CREATE INDEX idx_missoes_status ON missoes(status);

-- ── Histórico de Conversas ────────────────────────────────
CREATE TABLE conversas (
    id              SERIAL PRIMARY KEY,
    usuario_id      INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    mensagem        TEXT NOT NULL,
    resposta        TEXT NOT NULL,
    provedor        VARCHAR(50),     -- 'opencode-zen','openrouter'
    duracao_ms      INTEGER,
    criado_em       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_conversas_usuario ON conversas(usuario_id);
CREATE INDEX idx_conversas_data ON conversas(criado_em);
```

### 6.2 Dicionário de Dados

| Entidade | Descrição | Volume Estimado (MVP) |
|----------|-----------|----------------------|
| `usuarios` | Dados cadastrais dos idosos | Até 100 usuários |
| `atividades` | Catálogo de eventos/atividades comunitárias | Até 200 registros (curados manualmente) |
| `missoes` | Missões sociais atribuídas semanalmente | Até 50/semana |
| `conversas` | Histórico de interações com a IA | Até 5.000/mês |

---

## 7. Requisitos de Interface Externa

### 7.1 Interface com o Usuário (Telegram)

| Aspecto | Especificação |
|---------|---------------|
| Canal primário | Telegram via Telegram Bot API |
| Formato de entrada | Texto (obrigatório), Áudio (opcional), Imagem (opcional para confirmação de missão) |
| Formato de saída | Texto com formatação simples, botões de resposta inline keyboards |
| Áudio | Transcrição via API de reconhecimento de fala |
| Tratamento | Linguagem simples, frases curtas, tom acolhedor, tratamento "sr./sra." |

### 7.2 Interface com Provedores de IA

| Provedor | Endpoint | Autenticação | Modelo |
|----------|----------|-------------|--------|
| OpenCode Zen | `POST https://opencode.ai/zen/v1/chat/completions` | Bearer Token | `deepseek-v4-flash-free` |
| OpenRouter (fallback) | `POST https://openrouter.ai/api/v1/chat/completions` | Bearer Token | `meta-llama/llama-3.3-70b-instruct:free` |

**Exemplo de requisição (OpenAI-compatible):**

```json
POST https://opencode.ai/zen/v1/chat/completions
Authorization: Bearer sk-...
Content-Type: application/json

{
  "model": "deepseek-v4-flash-free",
  "messages": [
    {
      "role": "system",
      "content": "Você é o Amparo, um assistente amigável..."
    },
    {
      "role": "user",
      "content": "Quais atividades têm hoje perto de casa?"
    }
  ],
  "max_tokens": 1024,
  "temperature": 0.7
}
```

### 7.3 Interface com Telegram Bot API

| Operação | Endpoint | Descrição |
|----------|----------|-----------|
| Enviar texto | `POST https://api.telegram.org/bot{token}/sendMessage` | Envio de respostas ao usuário |
| Receber mensagem | Webhook configurado via `setWebhook` | Recebimento de mensagens do usuário |

---

## 8. MVP — Produto Mínimo Viável

### 8.1 Escopo do MVP

O MVP contempla as funcionalidades essenciais para validar a proposta de valor com usuários reais:

| Módulo | Funcionalidades incluídas | Prioridade |
|--------|--------------------------|------------|
| **Cadastro** | Nome, bairro/região, interesses, consentimento LGPD | 🔴 Essencial |
| **Conversação** | Texto, histórico de sessão, resposta em linguagem simples | 🔴 Essencial |
| **Recomendação** | Base curada de atividades, filtro por região e interesse | 🔴 Essencial |
| **Lembretes** | Notificações semanais de atividades | 🟡 Importante |
| **Missões Sociais** | Missão semanal, confirmação por texto | 🟡 Importante |
| **IA Proativa** | Mensagens de incentivo, detecção básica de engajamento | 🔵 Desejável |

### 8.2 O que NÃO está no MVP

| Funcionalidade | Motivo | Versão prevista |
|---------------|--------|-----------------|
| Transcrição de áudio | Complexidade adicional de integração com STT | V2 |
| Botões interativos do Telegram | Requer implementação de inline keyboards | V2 |
| Compras assistidas | Não é mais o foco principal do produto | V3 |
| Integração automática com calendários públicos | Depende de API de prefeituras e parceiros | V3 |
| Painel administrativo | Não necessário para validação com usuários | V4 |
| Expansão para múltiplas cidades | MVP focado em uma cidade-piloto (Santo André) | V4 |
| Compra de benefícios com parceiros | Depende de cadastro de parceiros | V4 |

### 8.3 Critérios de Aceitação do MVP

| Código | Critério | Tipo |
|--------|----------|------|
| C-01 | Usuário completa cadastro em até 5 interações pelo Telegram | Funcional |
| C-02 | Sistema recomenda ao menos 3 atividades relevantes para o perfil do usuário | Funcional |
| C-03 | Lembretes são enviados no horário configurado pelo usuário | Funcional |
| C-04 | Usuário recebe uma Missão Social por semana | Funcional |
| C-05 | Usuário recebe reconhecimento ao completar uma missão | Funcional |
| C-06 | Sistema responde 95% das mensagens em até 10 segundos | Desempenho |
| C-07 | Fallback para OpenRouter quando OpenCode Zen falha | Confiabilidade |
| C-08 | Dados do usuário são armazenados somente após consentimento explícito | Segurança |
| C-09 | Mensagens usam linguagem simples, sem jargões técnicos | Usabilidade |
| C-10 | Sistema mantém histórico da conversa por sessão | Funcional |

---

## 9. Roadmap

```
V1 ─ MVP (Julho 2026)
  ├── Cadastro + Perfil
  ├── Recomendação de atividades (base curada)
  ├── Lembretes semanais
  ├── Missões Sociais
  ├── Conversação texto (LLM)
  └── Telegram como canal único

V2 ─ IA Personalizada (Agosto 2026)
  ├── Transcrição de áudio (STT)
  ├── Botões interativos Telegram
  ├── IA Proativa (detecção de baixo engajamento)
  ├── Perfil mais completo (restrições, preferências)
  ├── Histórico e personalização avançada
  └── Ampliação de parceiros

V3 ─ Integração com Calendários Públicos (Setembro 2026)
  ├── Raspagem automática de calendários culturais
  ├── Compras assistidas (versão simples)
  ├── Suporte a múltiplos canais (Telegram)
  └── Dashboard de atividades para administradores

V4 ─ Escala (Outubro 2026+)
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
| Reduzir o isolamento social de pessoas idosas | RF-007, RF-013, RF-018, RF-025, RF-026 |
| Reduzir carga cognitiva no uso de tecnologia | RF-030, RF-031, RF-032, RNF-001 |
| Memorizar preferências do usuário | RF-001, RF-002, RF-005, RF-029 |
| Promover autonomia digital e social | RF-007, RF-012, RF-018, RF-023 |
| Envolver familiares e cuidadores | (previsto para V4) |

### 10.2 Glossário

| Termo | Definição |
|-------|-----------|
| Amparo | Assistente conversacional para idosos |
| Bairro | Divisão geográfica usada para filtrar atividades locais |
| Envelhecimento Ativo | Conceito da OMS: processo de otimizar oportunidades de saúde, participação e segurança |
| Gamificação | Uso de elementos de jogos (missões) para engajar usuários |
| Isolamento Social | Ausência de contato ou interação com a comunidade |
| LGPD | Lei Geral de Proteção de Dados Pessoais (Brasil) |
| LLM | Large Language Model (Modelo de Linguagem de Grande Escala) |
| Missão Social | Desafio semanal que estimula interação comunitária |
| Missão Social | Desafio semanal que estimula interação comunitária |
| Provedor LLM | Serviço de API que fornece acesso a modelos de IA |

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
12. **Ao recomendar atividade**, SEMpre inclua:
    - Nome da atividade
    - Endereço (ou ponto de referência conhecido)
    - Data e horário (em formato "terça-feira, 14h")
    - Frase de incentivo ("Que tal ir?")
13. **Confirme** que entendeu antes de agir ("Então quer dizer que você gosta de...")

## Fluxo de Cadastro (primeiro contato)
14. Ao receber "Oi", "Olá", "Bom dia" ou "/start":
    - Seja breve. Apresente-se em 1 parágrafo
    - Faça UMA pergunta por vez (não sobrecarregue)
    - Ordem das perguntas: ❶ Nome → ❷ Bairro → ❸ Interesses (lista de opções)
15. Após o cadastro, já sugira UMA atividade disponível na região

## Engajamento e Missões
16. Uma vez por semana, sugira uma **Missão Social** personalizada
17. Missões devem ser específicas: "visitar a Biblioteca Municipal" em vez de "fazer algo cultural"
18. Após confirmar missão, parabenize com entusiasmo genuíno 🎉
19. Se o usuário sumir por 3+ dias sem interagir, envie uma mensagem curta e acolhedora:
    "Saudades, sra. Maria! 🌻 Como estão as coisas? Quer ver as atividades da semana?"

## Tratamento de Erros
20. Se não entender a mensagem, peça desculpas e peça para repetir de forma mais simples
21. Se o usuário estiver irritado ou frustrado, acolha e ofereça ajuda prática
22. Se perguntar algo fora do escopo (política, religião, saúde grave), diga que não sabe 
    e sugira procurar um profissional ou serviço especializado
23. Se perguntar sobre preços ou compras: "No momento estou focado em atividades sociais. 
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

## Missão Social
AMPARO: Sra. Maria, sua missão desta semana: visitar a 
Biblioteca Municipal de Santo André (Rua Xavier de Toledo, 
269). Tem sessão de leitura toda quarta às 10h. Que acha? 📚

---

# FERRAMENTAS DISPONÍVEIS

Estas funções você pode chamar automaticamente quando 
detectar a intenção correta:

| Intenção | Ferramenta | Descrição |
|----------|-----------|-----------|
| Usuário quer ver atividades | `recomendar_atividades(bairro, interesses)` | Retorna lista de atividades filtradas por bairro e interesses |
| Usuário completou 1 semana | `criar_missao_social(usuario_id)` | Gera missão semanal personalizada |
| Hora de lembrar | `lembrete_atividades(usuario_id)` | Envia lembretes programados das atividades |
| Usuário confirma presença | `confirmar_presenca(missao_id, tipo_confirmacao)` | Registra conclusão de missão (texto, áudio ou foto) |
```

---

**© 2026 — Projeto Amparo**  
Documento de Especificação de Requisitos de Software
