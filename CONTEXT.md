# Amparo

Plataforma conversacional via Telegram que combate o isolamento social de pessoas idosas, conectando-as a atividades comunitárias perto de casa.

## Language

**Amparo**:
Assistente conversacional (bot Telegram) com persona acolhedora que recomenda atividades e incentiva participação social.
_Avoid_: bot, robô, chatbot

**Usuário**:
Pessoa idosa (60+) que interage com o Amparo pelo Telegram.
_Avoid_: cliente, paciente, beneficiário

**Bairro**:
Divisão geográfica usada para filtrar atividades locais de um usuário. Na Busca Web, o bairro é um ponto de partida: se a região do usuário não atende, a busca amplia para outros bairros da cidade.
_Avoid_: região, zona

**Pedido de Atividade**:
Mensagem do usuário em que ele pede atividades; detectada por heurística no webhook (não pela LLM), dispara a Busca Web + Curadoria da IA.
_Avoid_: solicitação de atividade, pergunta de atividade

**Interesse**:
Preferência declarada do usuário (cultura, esporte, leitura, música, artesanato, voluntariado) usada na recomendação.
_Avoid_: categoria de perfil, hobby

**Atividade**:
Evento comunitário curado (oficina, curso, grupo, serviço) oferecido por um parceiro.
_Avoid_: evento (quando é atividade curada), oportunidade

**Base de Atividades**:
Catálogo curado de atividades por cidade (arquivos `data/atividades-<cidade>.json`).
_Avoid_: banco de atividades, feed

**Recomendação**:
Lista de atividades filtrada por bairro e interesses do usuário, curada pela IA a partir da Base de Atividades e/ou de Resultados da Busca.
_Avoid_: sugestão, dica

**Busca Web**:
Consulta em tempo real na Instância SearXNG Própria, acionada sempre que o usuário pede atividades; os Resultados da Busca passam pela curadoria da IA antes de virar Recomendação. Se a Instância estiver indisponível, a Recomendação sai só da Base de Atividades.
_Avoid_: pesquisa online, raspagem, instância comunitária

**Instância SearXNG Própria**:
Servidor SearXNG do operador (contêiner Docker dedicado) exposto via túnel com HTTPS e acessível apenas ao Amparo por credencial; único provedor de Resultados da Busca.
_Avoid_: SearXNG comunitário, instância pública

**Resultado da Busca**:
Item não curado retornado pela Busca Web (nome, descrição, link, fonte), que precisa passar pela curadoria da IA antes de virar Recomendação.
_Avoid_: achado, item de pesquisa, Atividade (antes de curado)

**Curadoria da IA**:
Passo em que a IA lê a fusão de Base de Atividades e Resultados da Busca, seleciona as relevantes para o usuário e escreve a mensagem final. Se falhar ou não puder rodar, o sistema cai no template.
_Avoid_: formatação, segunda LLM, pós-processamento

**Lembrete Proativo**:
Mensagem enviada pelo sistema (não pelo usuário) em horário configurado, relembrando atividades.
_Avoid_: notificação, alerta

**IA Proativa**:
Comportamento do sistema de iniciar conversa quando detecta inatividade do usuário (3+ dias sem interação).
_Avoid_: push, engajamento automático

**Sessão**:
Estado persistido por usuário (perfil + histórico de conversa) usado para manter contexto entre mensagens.
_Avoid_: chat, conversa

**Parceiro**:
Instituição que fornece atividades à Base (Sesc, prefeituras, bibliotecas, UBS, centros comunitários).
_Avoid_: fornecedor, instituição (quando é parceiro)

**Consentimento**:
Autorização explícita do usuário para armazenar e tratar seus dados pessoais (LGPD).
_Avoid_: autorização (genérica), aceite