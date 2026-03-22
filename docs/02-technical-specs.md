# Phase 2 — Spécifications Techniques (v2)

**Projet** : FYREN Platform  
**Date** : 21 mars 2026  
**Structure** : Conforme au Patch #1 du SaaS Product Factory v3  
**Principe** : Spécifier du CŒUR vers la PÉRIPHÉRIE, composant par composant

---

## Identification du cœur

> **"Quel est le composant sans lequel le produit n'a aucune raison d'exister ?"**

Si on retire le moteur agentique → FYREN est un formulaire.  
Si on retire le preview live → FYREN est un terminal.  
Si on retire les intégrations services → FYREN ne déploie rien chez le client.

**Cœur** = le moteur agentique (Claude Agent SDK + sandbox)  
**Différenciateur** = preview live + ownership client (deploy sur son infra)  
**Intégrations** = GitHub, Supabase, Clerk, Stripe, Vercel (SDK/API publiques)  
**Plomberie** = auth FYREN, BDD FYREN, billing, hosting FYREN

---

## Phase 2.0 — Recherche des briques existantes

> **Règle absolue** : avant de proposer une architecture ou de spécifier un composant, rechercher s'il existe déjà en open source, en API publique, ou en SDK.

### Composant 1 : Moteur agentique

| Brique | URL | Licence | Maturité | Ce qu'elle fait |
|---|---|---|---|---|
| **Claude Agent SDK** (TypeScript) | github.com/anthropics/claude-agent-sdk-typescript | Anthropic Commercial ToS | Package npm `@anthropic-ai/claude-agent-sdk` v0.2+, renommé depuis Claude Code SDK. Docs officielles sur platform.claude.com | Agent loop complet : tools (Read, Edit, Bash, Glob, Grep, WebSearch), subagents natifs (parallèles, contexte isolé), sessions persistantes, MCP intégré, hooks (PreToolUse, PostToolUse), permissions configurables |
| **Claude Agent SDK** (Python) | pypi: `claude-agent-sdk` | Anthropic Commercial ToS | Parité avec TypeScript | Même moteur, API Python async |
| **claude-agent-server** | github.com/dzhng/claude-agent-server | Open source, ~305 stars | Dernière MAJ déc. 2025. Package npm `@dzhng/claude-agent` | WebSocket wrapper pour le Claude Agent SDK. Fait tourner l'agent dans un sandbox E2B, contrôle via WebSocket. Architecture monorepo : server + client + e2b-build |
| **Sandbox Agent SDK** (Rivet) | github.com/rivet-dev/sandbox-agent | Open source (Rust) | ~2026, adopté par InfoQ. Binary Rust 15MB, zéro dépendances | API HTTP/SSE universelle pour contrôler Claude Code, Codex, OpenCode, Amp. Un seul endpoint, swap d'agent par config. Supporte E2B, Daytona, Vercel Sandboxes, Docker |
| **claude-agent-sdk-demos** | github.com/anthropics/claude-agent-sdk-demos | Anthropic | Demos officielles : multi-agent research, branding assistant, V2 Session API | Patterns de référence pour subagents, sessions multi-turn, visual HTML previews |

**Décision** : Le Claude Agent SDK est le moteur. Le claude-agent-server de dzhng est le bridge WebSocket le plus direct (exactement le pattern FYREN). Le Sandbox Agent de Rivet est une alternative plus mature et universelle — à évaluer.

**Question client** : "Qu'est-ce qu'on construit PAR-DESSUS le Claude Agent SDK ?" → L'agent d'intake conversationnel (system prompts spécialisés), le routage LLM intelligent, et la couche d'orchestration multi-agents FYREN.

### Composant 2 : Preview live in-browser

| Brique | URL | Licence | Maturité | Ce qu'elle fait |
|---|---|---|---|---|
| **WebContainers API** | webcontainers.io | StackBlitz propriétaire. Gratuit open source / prototypes. **Licence commerciale requise** pour usage for-profit en production | Battle-tested par millions d'users. StackBlitz $135M+ levés, $700M valorisation. Bolt.new ($40M ARR) construit dessus | Node.js complet dans le browser (WASM). npm/pnpm natifs, dev server HMR, filesystem virtuel éphémère. Tous les browsers majeurs |
| **Lifo** | lifo.sh / github.com/lifo-sh/lifo | Open source | Très récent (début 2026). APIs Linux/Unix in-browser. Filesystem IndexedDB. 60+ commandes, git intégré | OS browser-natif. Gratuit à toute échelle. Zéro serveur. Shims fs/path/process/child_process. Supporte Next.js, Express, Expo |
| **Sandpack** (CodeSandbox) | github.com/codesandbox/sandpack | Open source (Apache 2.0) | Mature, utilisé par CodeSandbox | Composant React pour preview de code. Moins puissant que WebContainers (pas de vrai Node.js), plutôt des bundlers in-browser |

**Décision** : WebContainers reste le choix le plus fiable et battle-tested, mais la licence commerciale est un coût/risque. Lifo est l'alternative open source à surveiller — si elle mûrit, c'est un game changer. Pour le MVP, prévoir une abstraction qui permet de swapper.

**Ce qui n'existe PAS** : La sync bidirectionnelle agent ↔ preview (l'agent écrit des fichiers dans le sandbox côté serveur, le preview les affiche côté browser). C'est un bridge custom à construire.

### Composant 3 : Intégrations services client (deploy sur l'infra du client)

| Brique | URL | Licence | Ce qu'elle fait |
|---|---|---|---|
| **Dyad — GitHub handlers** | github.com/dyad-sh/dyad (src/) | Apache 2.0 (hors src/pro/) | OAuth GitHub, push code, gestion de repos. ~1 431 lignes. Réutilisable directement |
| **Dyad — Vercel handlers** | idem | Apache 2.0 | Deploy via Vercel SDK officiel (@vercel/sdk). ~596 lignes |
| **Dyad — Supabase management** | github.com/dyad-sh/supabase-management-js | Fork Apache 2.0 | Wrapper pour Supabase Management API. Package npm `@dyad-sh/supabase-management-js`. Création de projets, schema, RLS |
| **Octokit** | github.com/octokit | MIT | SDK officiel GitHub. Toutes les opérations Git/GitHub |
| **@vercel/sdk** | vercel.com/docs/rest-api | Vercel officiel | SDK officiel Vercel. Deploy, domains, env vars |
| **Supabase Management API** | supabase.com/docs/reference/api | Supabase officiel | API REST pour gérer projets, tables, RLS, edge functions |
| **Clerk API** | clerk.com/docs | Clerk officiel | SDK pour configurer auth, rôles, SSO |
| **Stripe API** | stripe.com/docs | Stripe officiel | SDK pour produits, prix, subscriptions, metered billing |
| **Dyad — System prompts** | github.com/dyad-sh/dyad (src/) | Apache 2.0 | ~582 lignes de system prompts encodant les best practices de generation React/Vite/shadcn. Patterns de tags `<dyad-write>`, `<dyad-delete>` |

**Décision** : Toutes les intégrations utilisent des API publiques. Dyad fournit des handlers open source réutilisables pour les 3 services principaux (GitHub, Vercel, Supabase). Aucun partenariat ou accord spécial nécessaire.

### Composant 4 : Sandbox / Hosting de l'agent

| Brique | URL | Modèle | Coût |
|---|---|---|---|
| **E2B** | e2b.dev | Cloud. Firecracker microVMs | $0.05/hr. Free 100h/mois hobby |
| **Daytona** | daytona.io | Cloud. Docker. Stop/resume natif | $200 crédits gratuits. $0.036/hr |
| **Fly Machines** | fly.io | Cloud. Micro-VMs. Pause/resume | ~$0.0016/hr (paused), $0.015/hr (running) |
| **Vercel Sandbox** | vercel.com | Cloud. Intégré à l'écosystème Vercel | $0.128/hr |
| **Docker self-hosted** | docker.com | Self-hosted | Coût serveur uniquement |
| **Modal** | modal.com | Cloud. GPU + CPU. Python-first | $0.03/hr CPU |

**Décision** : E2B est le choix le plus naturel (claude-agent-server l'utilise déjà). Fly Machines est le plus économique pour des sessions longues avec pause/resume. L'architecture doit abstraire le provider de sandbox.

### Composant 5 : Scaffold / template des apps générées

| Brique | URL | Licence | Ce qu'elle fait |
|---|---|---|---|
| **Dyad scaffold template** | github.com/dyad-sh/nextjs-template | Apache 2.0 | Template React + Vite + Tailwind + shadcn/ui. Structure prête à l'emploi |
| **create-next-app** | nextjs.org | MIT | Scaffolding officiel Next.js |
| **shadcn/ui** | ui.shadcn.com | MIT | Composants UI. Standard de facto dans l'écosystème |

**Décision** : Utiliser le template Dyad comme base pour les apps générées. C'est exactement la stack recommandée aux clients.

---

## Phase 2.1 — Composant cœur : le moteur agentique

### Architecture du moteur

Le cœur de FYREN est un Claude Agent SDK qui tourne côté serveur dans un container sandboxé, et communique avec le frontend via WebSocket/SSE.

```
┌─────────────────────────────────────────────────────────┐
│                    FYREN Frontend                         │
│  ┌──────────────┐     ┌───────────────────────────┐     │
│  │  Chat Panel   │     │   Preview Panel            │     │
│  │  (React)      │     │   (WebContainer/iframe)    │     │
│  └──────┬───────┘     └────────────┬──────────────┘     │
│         │ WebSocket                 │ File sync           │
│         │                           │                     │
└─────────┼───────────────────────────┼─────────────────────┘
          │                           │
          ▼                           ▼
┌─────────────────────────────────────────────────────────┐
│              FYREN Backend (Next.js API)                  │
│  ┌─────────────────────────────────────────────────────┐│
│  │  Session Manager                                     ││
│  │  - Crée/détruit les containers sandbox               ││
│  │  - Route les messages WebSocket ↔ Agent SDK          ││
│  │  - Gère le billing (tokens consommés → crédits)      ││
│  └──────────────────────┬──────────────────────────────┘│
└─────────────────────────┼───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Sandbox Container (E2B / Fly / Docker)       │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐│
│  │  Claude Agent SDK (long-running process)             ││
│  │                                                       ││
│  │  SystemPrompt: mode intake / build / iterate          ││
│  │  Tools: Read, Edit, Bash, Glob, Grep + custom tools   ││
│  │  Subagents:                                           ││
│  │    - Intake Agent (conversation structurée)           ││
│  │    - Architect Agent (CDC → architecture)             ││
│  │    - Builder Agent (code generation)                  ││
│  │    - Reviewer Agent (quality gate)                    ││
│  │                                                       ││
│  │  Filesystem éphémère:                                 ││
│  │    /workspace/                                        ││
│  │      ├── src/                                         ││
│  │      ├── package.json                                 ││
│  │      ├── CLAUDE.md (context engineering)              ││
│  │      └── ...                                          ││
│  └─────────────────────────────────────────────────────┘│
│                                                           │
│  Port exposé → Preview URL (si preview côté serveur)     │
└─────────────────────────────────────────────────────────┘
```

### Comment le Claude Agent SDK fonctionne (documentation officielle)

1. **Process long-running** : pas un appel API stateless. L'agent maintient un état conversationnel et exécute des commandes dans un environnement persistant.

2. **Agent loop** : `query()` retourne un async iterator. Claude pense → appelle un tool → observe le résultat → décide quoi faire ensuite. Le SDK gère l'orchestration (tool execution, context management, retries).

3. **Built-in tools** : Read, Edit, MultiEdit, Bash, Glob, Grep, WebSearch. Pas besoin de les implémenter.

4. **Subagents natifs** : chaque subagent est une instance séparée avec sa propre conversation fresh. Les appels de tools intermédiaires restent dans le subagent — seul le message final retourne au parent. Plusieurs subagents peuvent tourner en parallèle.

5. **Hooks** : PreToolUse et PostToolUse pour intercepter les actions de l'agent (logging, approbation, billing).

6. **Sessions** : V2 Session API (unstable_v2_*) permet `send()`/`stream()` séparés avec persistance de session et conversations multi-turn.

7. **MCP intégré** : l'agent peut se connecter à des serveurs MCP pour accéder à des outils externes.

8. **Configuration** : systemPrompt, allowedTools, permissionMode, model, maxTurns, settingSources.

### Les 3 modes de FYREN

**Mode Intake** :
- System prompt = consultant produit IA
- Tools = Read (pour analyser un repo existant si migration)
- Modèle = Claude Sonnet (rapide, bon en conversation)
- Output = CDC en JSON structuré
- L'agent ne génère PAS de code

**Mode Build** :
- System prompt = développeur senior
- Tools = Read, Edit, Bash, Glob, Grep
- Modèle = Claude Sonnet (code) / Opus (architecture)
- Input = CDC + connexions services client
- Output = fichiers dans /workspace/
- Subagents possibles : un par module (frontend, backend, config)

**Mode Iterate** :
- System prompt = pair programmer
- Tools = Read, Edit, Bash, Glob, Grep
- Modèle = Claude Sonnet
- Input = codebase actuel + demande client
- Output = modifications ciblées

### Décisions d'architecture

**Choix 1 : Claude Agent SDK direct vs claude-agent-server vs Sandbox Agent**

| Option | Pour | Contre |
|---|---|---|
| Claude Agent SDK direct | Contrôle total. Pas de dépendance tierce | Implémenter soi-même le WebSocket bridge, le sandbox management, la gestion des sessions |
| claude-agent-server (dzhng) | Bridge WebSocket prêt. Intégration E2B native. Package npm. ~305 stars | Projet d'un seul dev. Dernière MAJ déc. 2025. Risque de maintenance |
| Sandbox Agent (Rivet) | API HTTP universelle. Multi-agent (Claude, Codex, etc.). Binary Rust robuste. Adopté par la communauté | Plus récent. Plus abstrait (on perd un peu de contrôle fin sur le Claude Agent SDK). Rust binary = pas Node.js natif |

**→ Décision : claude-agent-server (dzhng), forké dans l'org FYREN dès le jour 1.**

Raisonnement : FYREN a besoin d'exactement une chose — faire tourner le Claude Agent SDK dans un sandbox E2B et le contrôler via WebSocket. C'est littéralement ce que claude-agent-server fait. Construire un wrapper custom "inspiré de" revient à réécrire la même chose en redécouvrant les mêmes bugs — c'est l'anti-pattern du Patch #1. Le projet fait ~300 lignes de TypeScript — si le mainteneur abandonne, on fork et on maintient. Le risque est gérable.

Sandbox Agent (Rivet) est écarté pour le MVP : il supporte 6 agents différents dont on n'a pas besoin, ajoute une dépendance à un écosystème Rust/Rivet Actors, et son abstraction universelle nous fait perdre le contrôle fin sur le Claude Agent SDK.

**→ V2** : Évaluer Sandbox Agent SDK si besoin de support multi-modèle.

**Choix 2 : Provider de sandbox**

Pour le MVP : **E2B** — le plus mature pour les agents Claude, SDK TypeScript/Python, Firecracker isolation, $0.05/hr.  
Pour V2 : Évaluer Fly Machines ($0.015/hr running, pause/resume natif) ou Daytona.

Le coût sandbox est négligeable vs le coût tokens. Une session de build de 30 min = $0.025 en sandbox, ~$10 en tokens.

**Choix 3 : Communication Frontend ↔ Agent**

WebSocket bidirectionnel entre le frontend et le backend FYREN. Le backend FYREN proxy vers le container sandbox (qui expose un port HTTP/WebSocket).

Pattern : Frontend → WebSocket → FYREN API → HTTP/WS → Container Sandbox → Claude Agent SDK

Les messages streamés sont :
- `assistant_message` : texte de l'agent (affiché dans le chat)
- `tool_use` : l'agent utilise un outil (affiché comme activité)
- `tool_result` : résultat d'un outil (log)
- `file_change` : un fichier a été créé/modifié (sync vers le preview)
- `build_status` : progression du build

### Limites connues

1. **Cold start** : créer un container E2B prend ~200ms (Firecracker). Acceptable.
2. **Context rot** : conversations longues de build → utiliser maxTurns + subagents pour isoler.
3. **Coût tokens** : le build d'une app complète consomme $7-17 en tokens (coût FYREN). Le markup x3 donne $20-50 pour le client.
4. **Dépendance Anthropic** : le Claude Agent SDK est le cœur. Si Anthropic change les termes ou la pricing, impact direct. Mitigation V2 : Sandbox Agent SDK pour support multi-modèle.

### Preuve de faisabilité

- La documentation officielle Anthropic cite explicitement le "Site Builder" comme use case du Pattern 2 (Long-Running Sessions).
- claude-agent-server démontre que le bridge WebSocket fonctionne avec E2B.
- Dyad (19 900+ stars) prouve que le pattern "agent qui génère du React/Vite/shadcn" fonctionne en production.
- Bolt.new ($40M ARR) prouve que le preview WebContainers in-browser est viable commercialement.

**→ VALIDATION OMAR requise avant de passer à 2.2**

---

## Phase 2.2 — Composant différenciateur : preview live + ownership client

### Preview live

**Architecture** : Le preview doit montrer l'app en temps réel pendant que l'agent code.

**Option A — WebContainers (côté browser)** :
- L'agent génère du code dans le sandbox serveur
- Les fichiers modifiés sont envoyés au frontend via WebSocket
- Le frontend injecte les fichiers dans un WebContainer local
- Le WebContainer fait tourner `npm run dev` (Vite HMR)
- L'app s'affiche dans un iframe

Avantage : zéro coût serveur pour le preview, latence HMR sub-seconde.  
Inconvénient : licence commerciale StackBlitz requise. Sync bidirectionnelle à construire.

**Option B — Preview côté sandbox (port exposé)** :
- L'agent fait tourner `npm run dev` directement dans le container sandbox
- Le sandbox expose un port → URL publique
- Le frontend affiche cette URL dans un iframe

Avantage : pas de sync à gérer, c'est le même filesystem.  
Inconvénient : coût sandbox pour le preview (le container tourne tant que le preview est actif). Latence réseau.

**→ Décision : WebContainers dès le MVP (Option A).**

Raisonnement : le moment "wow" de FYREN (Phase 1) repose sur la qualité du preview live. Avec un preview côté sandbox (Option B), chaque interaction passe par le réseau — latence 50-200ms, HMR lent, expérience de screencast. Avec WebContainers, le dev server Vite tourne dans le browser du client — HMR sub-seconde, zéro latence réseau. C'est l'expérience de Bolt.new ($40M ARR), et cette fluidité est une raison majeure de leur succès.

La licence commerciale WebContainers est un investissement dans le cœur de l'expérience utilisateur, absorbé par les premiers clients payants. Lifo est écarté : trop récent (début 2026), pas de track record en production, tunneling réseau en développement — pas acceptable pour le composant le plus visible du produit.

**Pipeline de sync agent → preview** :
1. L'agent écrit des fichiers dans le sandbox E2B (`/workspace/`)
2. Un file watcher dans le sandbox détecte les changements
3. Les fichiers modifiés sont streamés via WebSocket au frontend
4. Le frontend injecte les fichiers dans le WebContainer local
5. Vite HMR détecte les changements → preview mis à jour en sub-seconde

### Ownership client (deploy sur l'infra du client)

Le vrai différenciateur. À la fin du build, le code est pushé sur le GitHub du client et déployé sur son Vercel.

**Pipeline de deploy** :

1. L'agent a fini de coder dans le sandbox → `/workspace/` contient l'app complète
2. FYREN Backend utilise les API keys chiffrées du client pour :
   a. **GitHub** : créer un repo (ou push sur un repo existant) via Octokit
   b. **Vercel** : créer un projet et lier au repo GitHub via @vercel/sdk
   c. **Supabase** : créer le schema + RLS via Supabase Management API (wrapper Dyad)
   d. **Clerk** : configurer l'auth si nécessaire via Clerk API
   e. **Stripe** : créer les produits/prix si nécessaire via Stripe API
3. Le push GitHub trigger automatiquement le deploy Vercel (standard Git integration)
4. L'app est live sur `[project].vercel.app` → le client peut ajouter son domaine custom

**Ce qui est réutilisable de Dyad** (Apache 2.0) :
- GitHub OAuth handlers (~1 431 lignes) → adapter pour le contexte server-side FYREN
- Vercel deploy handlers (~596 lignes) → réutiliser directement
- Supabase management client (~1 109 lignes + package npm) → réutiliser
- System prompts pour la génération React/Vite/shadcn (~582 lignes) → adapter

**Ce qui est à construire** :
- Le flow d'onboarding multi-comptes (guider le client étape par étape)
- Le chiffrement/déchiffrement des API keys
- L'orchestration du deploy (dans quel ordre configurer les services)
- La gestion des erreurs de deploy (rollback, retry)

### Sécurité des API keys client

Les API keys du client sont les données les plus sensibles de FYREN.

- Chiffrées AES-256-GCM côté serveur avant stockage en BDD
- Clé de chiffrement dans les env vars Vercel (jamais en BDD)
- Les API keys ne sont JAMAIS envoyées au LLM — l'agent reçoit une abstraction ("tu as accès au GitHub du client") et FYREN Backend exécute les opérations réelles
- Les API keys ne sont JAMAIS loguées — sanitization dans tous les logs
- Décryptées uniquement au moment de l'usage, en mémoire, jamais persistées en clair

**→ VALIDATION OMAR requise avant de passer à 2.3**

---

## Phase 2.3 — Intégrations et services externes

### Pour chaque service tiers

| Service | SDK/API | Doc | Limites | Alternative si défaillant |
|---|---|---|---|---|
| **OpenRouter** | REST API, Vercel AI SDK pour abstraction | openrouter.ai/docs | Rate limits par clé. Pricing variable par modèle | API Anthropic directe, OpenAI direct |
| **Supabase (FYREN BDD)** | `@supabase/supabase-js` | supabase.com/docs | Free tier 500MB, 50K MAU. Pro $25/mois | Neon, PlanetScale |
| **Clerk (auth FYREN)** | `@clerk/nextjs` | clerk.com/docs | Free < 10K MAU. Pro $25/mois | Supabase Auth, Auth0 |
| **Stripe (billing)** | `stripe` npm | stripe.com/docs | 2.9% + $0.30/tx | Lemonsqueezy |
| **E2B (sandbox)** | `e2b` npm | e2b.dev/docs | Free 100h/mois. Hobby $0.05/hr | Fly Machines, Daytona |
| **GitHub API** (pour le client) | `@octokit/rest` ou handlers Dyad | docs.github.com | 5 000 req/hr/user authenticated | GitLab API |
| **Vercel API** (pour le client) | `@vercel/sdk` ou handlers Dyad | vercel.com/docs/rest-api | Rate limits généreux | Netlify API, Cloudflare Pages |
| **Supabase Management API** (pour le client) | `@dyad-sh/supabase-management-js` | supabase.com/docs/reference/api | Dépend du plan client | Script SQL direct |
| **WebContainers** (preview) | `@webcontainer/api` | webcontainers.io/api | Licence commerciale requise pour for-profit. 500 sessions/mois free commercial | Lifo (open source), preview côté sandbox |

### Coûts mensuels estimés (MVP)

| Service | Coût/mois | Condition |
|---|---|---|
| Supabase (FYREN) | $0 → $25 | Free tier suffisant pour commencer |
| Clerk | $0 → $25 | Free < 10K MAU |
| Vercel (hosting FYREN) | $0 → $20 | Free tier suffisant pour commencer |
| E2B | $0 → variable | 100h gratuites, puis $0.05/hr |
| Stripe | 2.9% + $0.30/tx | Uniquement sur les achats de crédits |
| Domaine fyren.app | ~$15/an | — |
| **Total fixe** | **~$50/mois** | Hors coûts variables (E2B, tokens) |
| **Breakeven** | **3 clients × $30/mois** | Soit ~$90 de crédits consommés |

---

## Phase 2.4 — Infrastructure et plomberie

### Stack FYREN (la plateforme elle-même)

- **Frontend** : Next.js 15 (App Router) + React 19 + Tailwind 4 + shadcn/ui — même stack que les apps générées (cohérence)
- **Backend** : Next.js API Routes + Server Actions — monorepo, un seul deploy
- **BDD** : Supabase (Postgres + Realtime) — Realtime pour le streaming build status
- **Auth** : Clerk — SSO Google/GitHub OOTB, webhooks pour sync user
- **Paiement** : Stripe (metered billing via Stripe Meter API)
- **Hosting** : Vercel — Next.js natif, edge functions, CDN global
- **Domaine** : fyren.app

### Schéma de données (BDD FYREN)

```sql
-- Utilisateurs FYREN (sync Clerk via webhook)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  name TEXT,
  credits DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Projets
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, intake, building, deployed, archived
  cdc_json JSONB,              -- CDC structuré produit par l'intake
  stack_config JSONB,          -- services sélectionnés
  sandbox_id TEXT,             -- ID du container E2B actif
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Connexions services du client (API keys chiffrées)
CREATE TABLE service_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  service TEXT NOT NULL,        -- github, vercel, supabase, clerk, stripe, resend
  config JSONB NOT NULL,        -- tokens/keys chiffrés AES-256-GCM
  status TEXT DEFAULT 'pending', -- pending, connected, error
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Conversations (chat d'intake + build)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  type TEXT NOT NULL,            -- intake, build, iterate
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,            -- user, assistant, system
  content TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  cost_usd DECIMAL(8,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Transactions crédits
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,            -- purchase, usage, refund
  amount DECIMAL(10,2) NOT NULL, -- positif = achat, négatif = consommation
  description TEXT,
  stripe_id TEXT,
  project_id UUID REFERENCES projects(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own projects" ON projects
  FOR ALL USING (user_id = auth.uid());

ALTER TABLE service_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users see own connections" ON service_connections
  FOR ALL USING (project_id IN (
    SELECT id FROM projects WHERE user_id = auth.uid()
  ));

-- Idem pour conversations, messages, credit_transactions
```

### APIs (endpoints)

| Méthode | URL | Description | Auth | Rate limit |
|---|---|---|---|---|
| POST | /api/chat | Stream message LLM (intake ou build) | Oui | 30/min |
| GET | /api/projects | Liste projets user | Oui | 60/min |
| POST | /api/projects | Créer projet | Oui | 10/min |
| GET | /api/projects/[id] | Détail projet + CDC | Oui | 60/min |
| PATCH | /api/projects/[id] | Update projet/CDC | Oui | 30/min |
| POST | /api/connect/github | OAuth GitHub → save token | Oui | 5/min |
| POST | /api/connect/service | Save API key (Supabase, Clerk, etc.) | Oui | 10/min |
| GET | /api/connect/[project_id] | Liste connexions service | Oui | 30/min |
| POST | /api/build/start | Lance le build (crée sandbox) | Oui | 3/min |
| POST | /api/deploy | Push GitHub + trigger deploy | Oui | 5/min |
| GET | /api/billing/credits | Solde crédits | Oui | 60/min |
| POST | /api/billing/purchase | Achat crédits via Stripe | Oui | 5/min |
| GET | /api/billing/usage | Historique consommation | Oui | 30/min |
| POST | /api/webhooks/clerk | Webhook Clerk (user sync) | Signature | — |
| POST | /api/webhooks/stripe | Webhook Stripe (paiements) | Signature | — |

### Auth, Persistance & Sécurité

**Auth** : Clerk. Google OAuth, GitHub OAuth, Email magic link. Onboarding → $2 crédits offerts.

**Persistance** : Projets, CDC, conversations en Supabase (RLS). API keys chiffrées AES-256-GCM. Code dans le sandbox (éphémère) → pushé sur GitHub client (persistent).

**Sécurité** : TLS 1.3. API keys jamais envoyées au LLM ni loguées. Rate limiting par user. Webhook signature validation. Secrets dans Vercel env vars.

**RGPD** : Base légale = contrat. DELETE /api/user → cascade. Export JSON/CSV. Conservation 12 mois après dernière activité. DPA avec Clerk, Supabase, Stripe, OpenRouter.

### Monétisation

Pay-per-use, zéro abonnement. Le client charge des crédits, chaque interaction LLM consomme crédits (coût OpenRouter × 3).

| Action | Coût client | Coût réel |
|---|---|---|
| Conversation d'intake (15 min) | ~$1-3 | ~$0.30-1 |
| Build app simple | ~$5-15 | ~$1.50-5 |
| Build SaaS complet | ~$20-50 | ~$7-17 |
| Itération (ajout feature) | ~$2-10 | ~$0.70-3.30 |

Crédits de bienvenue : $2. Crédits sans expiration.

### UX Flows

**Navigation** : / (landing) → /sign-in (Clerk) → /app (dashboard) → /app/new (intake) → /app/project/[id] (workspace : chat + preview) → /app/project/[id]/deploy (status)

**Workspace** : split panel resizable. Chat à gauche, preview à droite. File tree en footer. Mode responsive : tabs sur mobile.

### Scope MVP vs itérations futures

**MVP** : Landing + auth + dashboard + agent intake (single agent Sonnet) + CDC viewer + connexion GitHub + Supabase + build engine + preview + deploy GitHub/Vercel + crédits Stripe + routage LLM OpenRouter.

**V2** : Multi-agent build (subagents parallèles), Clerk + Stripe setup automatisé sur compte client, import projet Lovable/Bolt existant, templates.

**V3** : Collaboration multi-user, mobile app generation, visual editor, marketplace.

### Qualité produit (ISO 25010)

1. **Adéquation fonctionnelle** : l'intake produit un CDC qui couvre TOUS les besoins. Le build matche le CDC.
2. **Fiabilité** : 99.5% (Vercel SLA). Fallback si OpenRouter tombe.
3. **Performance** : < 500ms premier token (streaming). Build composant < 30s. Preview HMR < 2s.
4. **Utilisabilité** : non-dev = sign-up au premier preview < 20 min. Zéro code touché.
5. **Sécurité** : API keys chiffrées, RLS, rate limiting, jamais de keys au LLM.
6. **Compatibilité** : apps générées = React/Vite standard, aucune dépendance FYREN.
7. **Maintenabilité** : monorepo Next.js, TypeScript strict, tests E2E Playwright.
8. **Portabilité** : le client peut quitter FYREN et garder un produit fonctionnel.

---

*Livrable conforme à docs/02-technical-specs.md — SaaS Product Factory v3, Phase 2 (Patch #1)*  
*Structure : 2.0 (recherche existant) → 2.1 (cœur) → 2.2 (différenciateur) → 2.3 (intégrations) → 2.4 (plomberie)*  
*Prochaine étape : Phase 3 — Validation (checklist)*
