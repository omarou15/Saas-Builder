# FYREN Platform

> Build it. Own it.

FYREN est une plateforme SaaS qui build des apps de production sur l'infrastructure du client — son GitHub, son Vercel, son Supabase, son Clerk, son Stripe. Le client possède 100% de son code et de son infra.

## Le problème

Les AI app builders (Lovable, Bolt, Replit) construisent des prototypes enfermés sur leurs plateformes. Le client ne possède rien. Le jour où il veut scaler, changer de stack, ou embaucher un dev — il repart de zéro.

## La solution

Un agent conversationnel guide le client pour structurer son besoin (CDC), puis build l'app directement sur les comptes du client. À la fin, le client peut annuler FYREN sans perdre une seule ligne de code.

## Stack

- **Frontend** : Next.js 15 + React 19 + Tailwind 4 + shadcn/ui
- **Backend** : Next.js API Routes + Server Actions
- **BDD** : Supabase (Postgres + Realtime)
- **Auth** : Clerk
- **Agent** : Claude Agent SDK via claude-agent-server + E2B sandbox
- **Preview** : WebContainers API (StackBlitz)
- **LLM** : OpenRouter (multi-modèle)
- **Paiement** : Stripe (metered billing)
- **Hosting** : Vercel

## Documentation

Toute la documentation de conception est dans `/docs/` :

| Phase | Document | Description |
|---|---|---|
| 0 | [00-research.md](docs/00-research.md) | Recherche concurrentielle & veille technique |
| 1 | [01-product-definition.md](docs/01-product-definition.md) | Personas, scénarios, comportement produit |
| 2 | [02-technical-specs.md](docs/02-technical-specs.md) | Architecture technique (Patch #1 appliqué) |
| 3 | [03-validation-checklist.md](docs/03-validation-checklist.md) | Checklist de validation pré-build |
| 4 | [04-context-engineering.md](docs/04-context-engineering.md) | CLAUDE.md, skills, stratégie context engineering |
| 5 | [05-task-distribution.md](docs/05-task-distribution.md) | Distribution des tâches + build pipeline |

## Pour builder (Claude Code)

```bash
# Lire en premier
cat claude-progress.txt
cat CLAUDE.md
cat docs/corrections-log.md

# Puis suivre les sessions de build dans docs/05-task-distribution.md
```

## Licence

Propriétaire — © 2026 FYREN / Energyco
