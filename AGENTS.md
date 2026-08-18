## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context — one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Secrets

Nunca commitar credenciais reais. `.gitignore` bloqueia `.env*` e `.vercel`;
só placeholders vão em `.env.example`. Antes de qualquer commit, revise `git
status`/`git diff` para confirmar que nenhuma chave, token ou URL de serviço
real (Telegram, LLM, banco, túneis) entrou no índice.