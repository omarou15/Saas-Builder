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

## Quick start (dev)

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env.local
# Fill in all values (Supabase, Clerk, Stripe, OpenRouter, E2B, etc.)

# 3. Run Supabase migrations
# Apply supabase/migrations/*.sql on your Supabase project

# 4. Dev server
npm run dev
```

## Deploy (Vercel)

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Link project
vercel link

# 3. Set env vars on Vercel (all vars from .env.example)
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
vercel env add CLERK_SECRET_KEY
vercel env add CLERK_WEBHOOK_SECRET
vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
vercel env add STRIPE_SECRET_KEY
vercel env add STRIPE_WEBHOOK_SECRET
vercel env add OPENROUTER_API_KEY
vercel env add E2B_API_KEY
vercel env add ENCRYPTION_KEY
vercel env add NEXT_PUBLIC_APP_URL
vercel env add GITHUB_CLIENT_ID
vercel env add GITHUB_CLIENT_SECRET

# 4. Deploy
vercel --prod

# 5. Configure webhooks
# Clerk: https://dashboard.clerk.com → Webhooks → https://your-domain.vercel.app/api/webhooks/clerk
# Stripe: stripe listen --forward-to https://your-domain.vercel.app/api/webhooks/stripe
```

### Environment variables

See [.env.example](.env.example) for the full list with documentation.

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key |
| `CLERK_WEBHOOK_SECRET` | Yes | Clerk webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable key |
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key |
| `E2B_API_KEY` | Yes | E2B sandbox API key |
| `ENCRYPTION_KEY` | Yes | AES-256-GCM key (base64) |
| `NEXT_PUBLIC_APP_URL` | Yes | Public app URL |
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth app client secret |

## Tests E2E (Playwright)

```bash
# Install browsers (first time)
npx playwright install chromium

# Run tests
npx playwright test

# Run with UI
npx playwright test --ui

# With Clerk auth (for dashboard/workspace tests)
CLERK_TESTING_TOKEN=your-token TEST_PROJECT_ID=uuid npx playwright test
```

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
