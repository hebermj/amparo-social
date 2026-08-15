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
Divisão geográfica usada para filtrar atividades locais de um usuário.
_Avoid_: região, zona

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
Lista de atividades filtrada por bairro e interesses do usuário, derivada da Base de Atividades.
_Avoid_: sugestão, dica

**Busca Web**:
Consulta em tempo real (SearXNG → Bing) usada quando a Base de Atividades não atende o pedido.
_Avoid_: pesquisa online, raspagem

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