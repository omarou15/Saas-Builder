# FYREN Platform

## Description
Plateforme SaaS qui build des apps sur l'infra du client (son GitHub, Vercel, Supabase, Clerk, Stripe) via conversation guidée + preview live. Le client possède 100% de son code.

## Stack
- Frontend : Next.js 15 (App Router) + React 19 + Tailwind 4 + shadcn/ui
- Backend : Next.js API Routes + Server Actions
- BDD : Supabase (Postgres + Realtime)
- Auth : Clerk
- Paiement : Stripe (metered billing)
- Agent : Claude Agent SDK via claude-agent-server (fork FYREN) + E2B
- Preview : WebContainers API (StackBlitz)
- LLM : OpenRouter (multi-modèle)
- Hosting : Vercel
- Domaine : fyren.app

## Règles métier critiques
1. Les API keys client sont TOUJOURS chiffrées AES-256-GCM avant stockage
2. Les API keys ne sont JAMAIS envoyées au LLM — l'agent reçoit une abstraction
3. Les API keys ne sont JAMAIS loguées — sanitization dans tous les logs
4. Le code généré n'a AUCUNE dépendance à FYREN — le client peut partir
5. L'agent ne code JAMAIS sans un CDC validé par le client
6. Chaque appel LLM est mesuré en tokens → converti en crédits (coût × 3)
7. RLS activé sur TOUTES les tables — un user ne voit que ses données
8. Le preview WebContainer est sync via WebSocket depuis le sandbox E2B
9. L'onboarding multi-comptes est PROGRESSIF — un service à la fois, au bon moment
10. Les skills UI/UX sont pré-embarqués dans chaque sandbox (voir docs/04-context-engineering.md §4.2)

## Conventions de code
- TypeScript strict (no any)
- Nommage : camelCase variables, PascalCase composants, kebab-case fichiers
- Structure :
  /src
    /app          → pages Next.js (App Router)
    /components   → composants React (shadcn/ui)
    /lib          → utilitaires, clients API, helpers
    /server       → server actions, API routes logic
    /types        → types TypeScript partagés
- Imports absolus avec @/ (tsconfig paths)
- Pas de barrel files (import direct depuis le fichier)
- Server Components par défaut, 'use client' uniquement quand nécessaire
- Zod pour la validation des inputs API
- Erreurs explicites (pas de catch silencieux)

## Architecture du build pipeline
FYREN orchestre le build client via un pipeline par étapes :
INTAKE → CONNECT → SCAFFOLD → BUILD_DB → BUILD_BACKEND → BUILD_FRONTEND → REVIEW → DEPLOY

Chaque étape a son propre modèle, contexte, tools et skills.
Voir docs/05-task-distribution.md pour les détails.

## Pièges connus
- Ne PAS utiliser localStorage dans les Server Components (Next.js 15)
- Ne PAS stocker les API keys en clair dans les env vars du sandbox client
- Ne PAS faire de fetch côté client vers OpenRouter — toujours proxy via /api/chat
- WebContainers : toujours attendre WebContainer.boot() avant d'écrire des fichiers
- E2B : implémenter un heartbeat pour les sessions longues (idle timeout)
- Clerk webhooks : toujours vérifier la signature AVANT de traiter le payload

## Références
- Specs techniques : docs/02-technical-specs.md
- Context engineering : docs/04-context-engineering.md
- Distribution des tâches : docs/05-task-distribution.md
- Erreurs corrigées : docs/corrections-log.md

## En cas de doute
Consulter la documentation officielle AVANT de deviner :
- Claude Agent SDK : platform.claude.com/docs/en/agent-sdk/
- WebContainers : webcontainers.io/api
- Dyad handlers : github.com/dyad-sh/dyad (src/, Apache 2.0)
- E2B : e2b.dev/docs
