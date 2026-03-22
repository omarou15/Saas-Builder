# Phase 5 — Distribution des tâches

**Projet** : FYREN Platform  
**Date** : 21 mars 2026  
**Réf** : Agile/Scrum — Sprint Planning  
**Objectif** : Assigner chaque bloc au bon agent — à DEUX niveaux.

---

## Deux niveaux de distribution

**Niveau 1** — Comment Omar distribue les tâches pour construire FYREN  
→ Document humain. Sessions de Claude Code planifiées.

**Niveau 2** — Comment FYREN distribue les tâches pour builder une app client  
→ Code dans l'architecture. Pipeline d'exécution programmé dans le backend FYREN.

Le niveau 2 est le plus important : c'est une feature produit, pas un doc de gestion de projet.

---

## Niveau 1 — Builder FYREN (Omar + Claude Code)

### Agents

| Agent | Rôle | Reçoit | Produit |
|---|---|---|---|
| **Claude Code (Omar)** | Backend + Frontend + Déploiement | CLAUDE.md niveau 1 + specs + progress.txt | Code FYREN fonctionnel, déployé |
| **Claude Chat Opus (ce chat)** | Architecture + CDC + Coordination | Vision produit + retours d'expérience | Docs phases 0-5, prompts, revue |

### Sessions de build (ordre d'exécution)

| # | Session | Durée cible | Contexte chargé | Livrable |
|---|---|---|---|---|
| 1 | Setup projet Next.js + config | 30 min | CLAUDE.md + specs §2.4 (stack) | Repo GitHub, structure de fichiers, config TS/Tailwind/shadcn |
| 2 | BDD Supabase + Auth Clerk | 30 min | CLAUDE.md + specs §2.4 (schéma, auth) | Tables créées, RLS, webhooks Clerk, middleware auth |
| 3 | API routes : projets + chat | 1-2h | CLAUDE.md + specs §2.4 (APIs) | CRUD projets, streaming chat via OpenRouter |
| 4 | API routes : connect + billing | 1h | CLAUDE.md + specs §2.3 (services) + §2.4 (monétisation) | OAuth GitHub, save API keys chiffrées, crédits Stripe |
| 5 | Agent SDK : intégration claude-agent-server | 2-3h | CLAUDE.md + specs §2.1 (cœur) + docs agent-sdk | Fork claude-agent-server, connexion E2B, bridge WebSocket, 3 modes (intake/build/iterate) |
| 6 | Preview : WebContainers + sync | 1-2h | CLAUDE.md + specs §2.2 (preview) + docs WebContainers | Boot WebContainer, sync fichiers via WebSocket, iframe preview |
| 7 | Deploy pipeline | 1h | CLAUDE.md + specs §2.2 (ownership) + dyad handlers | Push GitHub (Octokit), deploy Vercel (@vercel/sdk), schema Supabase |
| 8 | Frontend : landing + auth + dashboard | 2-3h | CLAUDE.md + specs §2.4 (UX flows) | Pages /, /sign-in, /app avec design pro (skills activés) |
| 9 | Frontend : workspace (chat + preview) | 2-3h | CLAUDE.md + specs §2.4 (workspace layout) | Split panel, chat streaming, preview iframe, file tree |
| 10 | Tests E2E + deploy prod | 1-2h | CLAUDE.md + specs §1 (scénarios) + progress.txt | 3 flows Playwright, deploy Vercel prod |

**Durée totale estimée** : 12-20h de sessions Claude Code (réparties sur 3-5 jours)

Entre chaque session :
1. L'agent met à jour `claude-progress.txt`
2. L'agent note les corrections dans `corrections-log.md`
3. L'agent commit le code
4. Omar review + valide avant la session suivante

---

## Niveau 2 — FYREN build pour un client (pipeline programmé)

### C'est quoi concrètement

Quand un client clique "Build" après avoir validé son CDC, FYREN ne fait pas "un gros prompt au Claude Agent SDK". FYREN exécute un **pipeline d'étapes séquentielles**, chacune avec son propre contexte, ses propres outils, et sa propre validation.

C'est une state machine codée dans `/src/server/build-pipeline.ts`.

### State machine du build client

```
┌─────────────┐
│   INTAKE     │  ← L'agent pose des questions, produit le CDC
│   (Sonnet)   │
└──────┬──────┘
       │ CDC validé par le client
       ▼
┌─────────────┐
│  CONNECT     │  ← Guide le client pour connecter ses services
│  (pas d'IA)  │     GitHub OAuth, Supabase API key, etc.
└──────┬──────┘
       │ Services connectés
       ▼
┌─────────────┐
│  SCAFFOLD    │  ← Crée la structure du projet
│  (Haiku)     │     Template React/Vite/shadcn, package.json, config
└──────┬──────┘
       │ Structure créée
       ▼
┌─────────────┐
│  BUILD_DB    │  ← Crée le schéma BDD + RLS
│  (Sonnet)    │     Via Supabase Management API (pas dans le sandbox)
└──────┬──────┘
       │ BDD prête
       ▼
┌─────────────┐
│  BUILD_BACK  │  ← Génère les API routes, server logic
│  (Sonnet)    │     Dans le sandbox, fichiers écrits dans /workspace/
└──────┬──────┘
       │ Backend généré
       ▼
┌─────────────┐
│  BUILD_FRONT │  ← Génère les composants UI, pages
│  (Sonnet)    │     Skills UI/UX actifs. Preview live mis à jour
└──────┬──────┘
       │ Frontend généré
       ▼
┌─────────────┐
│  REVIEW      │  ← Vérifie le code produit
│  (Opus MVP:  │     Accessibilité, sécurité, conventions
│   skip V1)   │
└──────┬──────┘
       │ Code validé
       ▼
┌─────────────┐
│  DEPLOY      │  ← Push GitHub + deploy Vercel
│  (pas d'IA)  │     Via Octokit + @vercel/sdk
└──────┬──────┘
       │ App live
       ▼
┌─────────────┐
│  DONE        │  ← L'app est sur l'infra du client
└─────────────┘
```

### Implémentation dans le code FYREN

```typescript
// /src/server/build-pipeline.ts

type BuildStage = 
  | 'intake'
  | 'connect' 
  | 'scaffold'
  | 'build_db'
  | 'build_backend'
  | 'build_frontend'
  | 'review'
  | 'deploy'
  | 'done';

interface BuildState {
  projectId: string;
  stage: BuildStage;
  cdc: CDC | null;
  connections: ServiceConnection[];
  sandboxId: string | null;
  errors: BuildError[];
  tokensUsed: number;
  creditsConsumed: number;
}

// Chaque stage a sa propre config agent
const STAGE_CONFIG: Record<BuildStage, StageConfig> = {
  intake: {
    model: 'anthropic/claude-sonnet-4',
    systemPrompt: INTAKE_PROMPT,      // consultant produit
    tools: ['Read'],                   // read repo si migration
    maxTurns: 50,                      // conversation longue OK
    skills: [],                        // pas de skills UI pour l'intake
  },
  scaffold: {
    model: 'anthropic/claude-haiku-4',
    systemPrompt: SCAFFOLD_PROMPT,     // génère la structure
    tools: ['Edit', 'Bash'],
    maxTurns: 10,                      // court, déterministe
    skills: [],
  },
  build_db: {
    model: 'anthropic/claude-sonnet-4',
    systemPrompt: DB_PROMPT,
    tools: ['Edit', 'Bash'],
    maxTurns: 15,
    skills: [],
  },
  build_backend: {
    model: 'anthropic/claude-sonnet-4',
    systemPrompt: BACKEND_PROMPT,
    tools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
    maxTurns: 30,
    skills: ['react-best-practices'],
  },
  build_frontend: {
    model: 'anthropic/claude-sonnet-4',
    systemPrompt: FRONTEND_PROMPT,     // dev senior + design
    tools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
    maxTurns: 50,
    skills: [
      'frontend-design',              // Tier 1
      'react-best-practices',         // Tier 1
      'web-design-guidelines',        // Tier 1
      'composition-patterns',         // Tier 1
    ],
  },
  review: {
    model: 'anthropic/claude-opus-4',
    systemPrompt: REVIEW_PROMPT,       // quality gate
    tools: ['Read', 'Glob', 'Grep'],
    maxTurns: 10,
    skills: ['web-design-guidelines'],
  },
  // connect et deploy ne sont pas des stages IA
  // ce sont des opérations programmatiques (OAuth, API calls)
  connect: { model: null, systemPrompt: null, tools: [], maxTurns: 0, skills: [] },
  deploy: { model: null, systemPrompt: null, tools: [], maxTurns: 0, skills: [] },
  done: { model: null, systemPrompt: null, tools: [], maxTurns: 0, skills: [] },
};
```

### Ce que le client voit pendant le pipeline

```
┌─────────────────────────────────────────────────────────┐
│  Chat Panel                                              │
│                                                          │
│  🟢 Intake terminé — CDC validé                         │
│  🟢 GitHub connecté                                     │
│  🟢 Supabase connecté                                   │
│  🔄 Build en cours — structure du projet...              │
│     ├── ✅ package.json créé                             │
│     ├── ✅ vite.config.ts configuré                      │
│     ├── 🔄 Composants UI en cours...                    │
│     │    └── Dashboard.tsx (en train d'écrire)           │
│  ⏳ Deploy — en attente                                 │
│                                                          │
│  [Le client peut interrompre à tout moment]              │
└─────────────────────────────────────────────────────────┘
```

Chaque transition entre stages :
1. Sauvegarde l'état en BDD (table `projects.status`)
2. Stream un événement `stage_change` au frontend via WebSocket
3. Décompte les tokens consommés → crédits débités
4. Si erreur → pause le pipeline, notifie le client, attend une action

### Pourquoi un pipeline et pas un gros prompt

| Un seul prompt | Pipeline par étapes |
|---|---|
| Context rot après 20 min de build | Chaque étape a un contexte frais |
| Si l'étape 5 échoue, on perd tout | Si l'étape 5 échoue, on reprend à l'étape 5 |
| Impossible de changer de modèle | Haiku pour le boilerplate, Sonnet pour le code, Opus pour la review |
| Le client ne voit rien pendant le build | Le client voit la progression en temps réel |
| Pas de point de contrôle | Le client peut interrompre et corriger entre les étapes |
| Un seul set de skills pour tout | Skills ciblés par étape (UI skills seulement pour le frontend) |
| Coût tokens quadratique | Coût tokens linéaire (contextes isolés) |

### Évolution V2 : subagents parallèles

En V2, les stages `build_backend` et `build_frontend` pourront tourner en parallèle comme subagents du Claude Agent SDK :

```
Agent Principal (orchestrateur)
├── Subagent build_backend  ─┐
│                             ├── en parallèle
├── Subagent build_frontend ─┘
│
└── Subagent review (après que les deux aient fini)
```

Cela réduit le temps de build de ~50% pour les apps avec backend + frontend.

Le code est déjà structuré pour ça : chaque stage est une config indépendante. Passer d'un pipeline séquentiel à un pipeline parallèle = changer l'orchestrateur, pas les stages.

---

*Livrable conforme à docs/05-task-distribution.md — SaaS Product Factory v3, Phase 5*  
*Niveau 1 : 10 sessions Omar + Claude Code (12-20h)*  
*Niveau 2 : Pipeline programmé dans /src/server/build-pipeline.ts*  
*Prochaine étape : Phase 6 — BUILD*
