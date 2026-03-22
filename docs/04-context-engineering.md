# Phase 4 — Context Engineering & Préparation IA

**Projet** : FYREN Platform  
**Date** : 21 mars 2026  
**Réf** : Anthropic "Effective context engineering for AI agents" (sept. 2025), Anthropic "Effective harnesses for long-running agents" (mars 2026)  
**Objectif** : Configurer l'environnement IA pour un build efficace et durable — à DEUX niveaux.

---

## Architecture double : FYREN se construit ET construit pour les clients

FYREN a une particularité : c'est un SaaS builder qui utilise les mêmes outils (Claude Agent SDK) pour se construire ET pour construire les apps de ses clients. Le context engineering existe donc à deux niveaux :

**Niveau 1** — Pour builder FYREN elle-même (Omar utilise Claude Code pour développer la plateforme)  
**Niveau 2** — Template que FYREN injecte dans chaque sandbox client (l'agent FYREN utilise ce contexte pour builder l'app du client)

Le niveau 2 est une version paramétrable du niveau 1. FYREN mange sa propre cuisine.

---

## 4.1 WRITE — Mémoire externe persistante

### CLAUDE.md — Niveau 1 (builder FYREN)

```markdown
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
10. Les skills UI/UX sont pré-embarqués dans chaque sandbox (voir §4.2)

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

## Pièges connus
- Ne PAS utiliser localStorage dans les Server Components (Next.js 15)
- Ne PAS stocker les API keys en clair dans les env vars du sandbox client — uniquement dans le backend FYREN
- Ne PAS faire de fetch côté client vers OpenRouter — toujours proxy via /api/chat
- WebContainers : le boot initial est async, toujours attendre WebContainer.boot() avant d'écrire des fichiers
- E2B : le container a un idle timeout — implémenter un heartbeat pour les sessions longues
- Clerk webhooks : toujours vérifier la signature AVANT de traiter le payload

## Références
- Specs techniques : docs/02-technical-specs-v2.md
- Briques Dyad réutilisables : docs/dyad-analysis-fyren.md
- Erreurs corrigées : docs/corrections-log.md

## En cas de doute
Consulter la documentation officielle AVANT de deviner :
- Claude Agent SDK : platform.claude.com/docs/en/agent-sdk/
- WebContainers : webcontainers.io/api
- Dyad handlers : github.com/dyad-sh/dyad (src/, Apache 2.0)
- E2B : e2b.dev/docs
```

### CLAUDE.md Template — Niveau 2 (apps client)

Ce template est injecté dans chaque sandbox E2B quand FYREN build une app pour un client. Les variables `{{...}}` sont remplies dynamiquement depuis le CDC du client.

```markdown
# {{project_name}}

## Description
{{project_description}}

## Stack
- Frontend : React 19 + Vite + Tailwind 4 + shadcn/ui
- {{#if supabase}}BDD : Supabase (Postgres + RLS){{/if}}
- {{#if clerk}}Auth : Clerk{{/if}}
- {{#if stripe}}Paiement : Stripe{{/if}}
- Hosting : Vercel (déployé sur le compte du client)

## Règles de build
1. Chaque composant UI utilise shadcn/ui — JAMAIS de CSS custom sauf si nécessaire
2. Les couleurs utilisent le système de design généré (voir .claude/skills/)
3. Accessibilité : ARIA labels, navigation clavier, contraste AA minimum
4. Responsive : mobile-first, breakpoints Tailwind (sm, md, lg)
5. Performance : pas de barrel imports, lazy loading des routes, images optimisées
6. {{#if supabase}}RLS activé sur TOUTES les tables dès la création{{/if}}
7. {{#if clerk}}Auth vérifié à chaque route protégée, pas seulement au layout{{/if}}
8. TypeScript strict — pas de `any`
9. Code documenté : chaque fichier a un commentaire d'en-tête expliquant son rôle
10. Tests : au minimum un test par page critique

## Conventions de code
- Structure Vite standard :
  /src
    /components    → composants React
    /pages         → pages/routes
    /lib           → utilitaires, clients API
    /hooks         → hooks custom
    /types         → types TypeScript
- Imports absolus avec @/ (vite.config alias)
- Server logic dans des fonctions séparées (pas dans les composants)

## Contexte client
{{cdc_summary}}

## Comportement attendu
{{behavior_rules}}

## En cas de doute
Suivre les conventions shadcn/ui et les skills pré-installés.
Ne JAMAIS inventer un design token — utiliser le design system généré.
```

### claude-progress.txt (Niveau 1 — builder FYREN)

```markdown
# État d'avancement — FYREN Platform
Dernière mise à jour : [date + heure]

## Complété
- [ ] (vide — le build n'a pas commencé)

## En cours
- [ ] Phase 4 — Context Engineering

## À faire (ordre du build Phase 6)
- [ ] Setup projet Next.js + Supabase + Clerk + Stripe
- [ ] Backend : API routes (chat, projects, connect, build, deploy, billing, webhooks)
- [ ] Frontend : Landing, Auth, Dashboard, Workspace (chat + preview)
- [ ] Agent : intégration Claude Agent SDK via claude-agent-server fork
- [ ] Preview : intégration WebContainers + sync WebSocket
- [ ] Deploy : pipeline GitHub push + Vercel deploy
- [ ] Billing : crédits Stripe metered
- [ ] Tests E2E : 3 flows principaux (Playwright)
- [ ] Déploiement : Vercel prod

## Décisions prises
- Claude Agent SDK via claude-agent-server (fork FYREN) + E2B
- WebContainers dès le MVP (pas preview côté sandbox)
- Skills UI/UX pré-embarqués (Frontend Design, React Best Practices, Web Design Guidelines, Composition Patterns)
- Briques Dyad réutilisées : GitHub handlers, Vercel handlers, Supabase management

## Problèmes ouverts
- Licence commerciale WebContainers : contacter StackBlitz pour les termes
- E2B idle timeout : implémenter heartbeat ou évaluer Fly Machines
```

### corrections-log.md (partagé niveaux 1 et 2)

```markdown
# Corrections Log — FYREN

## 21 mars 2026 — Skills UI/UX obligatoires
**Contexte** : Build d'apps client avec Claude Code
**Erreur** : Claude Code sans skills UI produit du "AI slop" — interfaces génériques, pas pro
**Correction** : Pré-embarquer les skills Frontend Design (Anthropic), React Best Practices (Vercel), Web Design Guidelines (Vercel), Composition Patterns (Vercel) dans chaque sandbox
**Cause** : Convergence distributionnelle — le modèle reproduit le centre statistique des décisions de design sans guidance explicite
**Règle** : TOUJOURS inclure les skills Tier 1 dans l'image sandbox E2B. Ne JAMAIS lancer un build client sans skills UI/UX activés.
```

---

## 4.2 SELECT — Récupération ciblée du contexte pertinent

### Skills pré-embarqués dans chaque sandbox (image E2B)

Le Claude Agent SDK supporte les skills via `.claude/skills/`. Ces skills sont pré-installés dans l'image Docker E2B et disponibles automatiquement dans chaque session de build client.

**Tier 1 — Obligatoires (dans chaque sandbox)**

| Skill | Source | Installs | Rôle |
|---|---|---|---|
| **Frontend Design** | `anthropics/skills` | 277K+ | Direction esthétique avant le code. Casse les patterns génériques. Typography, palettes, animations intentionnelles |
| **React Best Practices** | `vercel-labs/agent-skills` | 150K+ | 57 règles perf React/Next.js. Élimine waterfalls, optimise bundle, RSC patterns |
| **Web Design Guidelines** | `vercel-labs/agent-skills` | 133K+ | 100+ règles accessibilité/perf/UX. Audit automatique WCAG, ARIA, sémantique |
| **Composition Patterns** | `vercel-labs/agent-skills` | MIT | Anti-boolean-prop. Compound components, state lifting. Code maintenable |

**Tier 2 — Recommandés (activés selon le CDC)**

| Skill | Source | Quand l'activer |
|---|---|---|
| **UI/UX Pro Max** | `nextlevelbuilder/ui-ux-pro-max-skill` | Quand le CDC demande un design system spécifique (SaaS dashboard, e-commerce, etc.) |
| **Interface Design** | `Dammyjay93/interface-design` | Quand le projet a besoin de cohérence design sur 10+ composants |

**Installation dans l'image E2B** :

```bash
# Dans le Dockerfile de l'image sandbox FYREN
# Pré-installer les skills Tier 1
RUN npx skills add vercel-labs/agent-skills --skill react-best-practices --non-interactive
RUN npx skills add vercel-labs/agent-skills --skill web-design-guidelines --non-interactive
RUN npx skills add vercel-labs/agent-skills --skill composition-patterns --non-interactive
RUN npx skills add anthropics/skills --skill frontend-design --non-interactive
```

### Structure docs/ pour FYREN (Niveau 1)

```
docs/
├── 00-research-v2.md              ← Phase 0 : paysage concurrentiel
├── 01-product-definition.md       ← Phase 1 : personas, scénarios, comportement
├── 02-technical-specs-v2.md       ← Phase 2 : architecture (Patch #1)
├── 03-validation-checklist.md     ← Phase 3 : validation
├── 04-context-engineering.md      ← Phase 4 : ce document
├── dyad-analysis-fyren.md         ← Audit technique Dyad (briques réutilisables)
├── corrections-log.md             ← Erreurs corrigées (gold data vivante)
└── reference/
    ├── README.md                  ← Index des fichiers de référence
    ├── claude-agent-sdk-hosting.md ← Notes clés de la doc officielle hosting
    ├── dyad-handlers-api.md       ← API des handlers Dyad réutilisables
    └── webcontainers-api.md       ← Notes clés de la doc WebContainers
```

Nombre de fichiers de référence : < 20 → fichiers directs suffisent, pas de RAG nécessaire.

### Context injecté dans le sandbox client (Niveau 2)

Quand FYREN crée un sandbox pour builder l'app d'un client, le context est composé de :

```
/workspace/.claude/
├── CLAUDE.md                      ← Généré depuis le template + CDC du client
├── skills/
│   ├── frontend-design/           ← Tier 1 (pré-embarqué dans l'image)
│   ├── react-best-practices/      ← Tier 1
│   ├── web-design-guidelines/     ← Tier 1
│   ├── composition-patterns/      ← Tier 1
│   └── [skills Tier 2 si activés] ← Ajoutés dynamiquement selon le CDC
├── settings.json                  ← Config agent (model, tools, permissions)
└── commands/                      ← Commandes FYREN custom si nécessaire
```

L'agent FYREN ne charge PAS tout le CDC dans le contexte — il charge uniquement la section pertinente à la tâche en cours (SELECT).

---

## 4.3 COMPRESS — Gestion de la dégradation du contexte

### Pour le build de FYREN (Niveau 1)

Découpage des sessions de build en conversations courtes :

| Session | Contexte chargé | Messages cible |
|---|---|---|
| Setup projet + BDD + Auth | CLAUDE.md + specs §2.4 (schéma, auth) | 5-10 |
| API routes (chat, projects) | CLAUDE.md + specs §2.4 (APIs) | 5-10 |
| API routes (connect, build, deploy) | CLAUDE.md + specs §2.2 (ownership) + dyad-handlers | 5-10 |
| Agent SDK intégration | CLAUDE.md + specs §2.1 (cœur) + claude-agent-sdk docs | 5-10 |
| WebContainers preview | CLAUDE.md + specs §2.2 (preview) + webcontainers docs | 5-10 |
| Frontend landing + dashboard | CLAUDE.md + specs §2.4 (UX flows) | 5-10 |
| Frontend workspace (chat + preview) | CLAUDE.md + specs §2.4 (workspace layout) | 5-10 |
| Billing Stripe | CLAUDE.md + specs §2.4 (monétisation) | 5-10 |
| Tests E2E | CLAUDE.md + specs §1 (scénarios) | 5-10 |
| Deploy + polish | CLAUDE.md + progress.txt | 5-10 |

Chaque session :
1. Lit `claude-progress.txt` EN PREMIER
2. Charge UNIQUEMENT les refs pertinentes
3. Met à jour `claude-progress.txt` AVANT de terminer
4. Documente les erreurs dans `corrections-log.md`

### Pour les builds client (Niveau 2)

L'agent FYREN gère automatiquement la compression :

- **Intake** : 1 conversation Sonnet, ~15-20 messages max. Si le contexte dépasse → résumé structuré avant de passer au build.
- **Build** : utilise `maxTurns` pour limiter les itérations. Subagents pour isoler les tâches (un subagent par module).
- **Iterate** : chaque itération = nouvelle session avec le contexte minimal (CLAUDE.md + codebase actuel + demande du client).

---

## 4.4 ISOLATE — Compartimentalisation des tâches

### Pour le build de FYREN (Niveau 1)

10 sessions isolées (voir tableau §4.3). Chaque session = 1 conversation Claude Code.

Coordination via :
- `claude-progress.txt` (état d'avancement)
- `corrections-log.md` (erreurs à ne pas reproduire)
- Git (chaque session commit son travail)

### Pour les builds client (Niveau 2)

L'agent FYREN utilise les subagents natifs du Claude Agent SDK :

```
Agent Principal (orchestrateur)
├── Subagent Intake → conversation structurée, produit le CDC
├── Subagent Architect → CDC → architecture, fichiers de config
├── Subagent Frontend → génère les composants React/pages
├── Subagent Backend → génère les API routes, schéma BDD
└── Subagent Reviewer → quality gate, vérifie le code produit

Chaque subagent :
- A son propre contexte fresh (pas de pollution)
- Charge uniquement les skills pertinents
- Retourne un résultat structuré au parent
- Les outils intermédiaires restent dans le subagent
```

Pour le MVP : **single agent** (pas de subagents). Le découpage en subagents est prévu en V2 (multi-agent build).

MVP = un seul agent qui change de mode (intake → build → iterate) avec compression du contexte entre chaque mode.

---

## 4.5 Routage des modèles

### Pour FYREN elle-même (Omar build avec Claude Code)

Utiliser le routage par défaut de Claude Code (Sonnet pour le code, Opus pour l'architecture).

### Pour les builds client (via OpenRouter)

| Tâche | Modèle | Justification |
|---|---|---|
| Intake (conversation) | Claude Sonnet | Rapide, bon en conversation. ~$0.03-0.10/message |
| Architecture (CDC → specs) | Claude Opus | Raisonnement profond. ~$0.30-1.00 |
| Build (code generation) | Claude Sonnet | Bon code, coût raisonnable. ~$0.10-0.30/composant |
| Fix (debug, corrections) | Claude Sonnet | Rapide |
| Review (quality gate) | Claude Opus | Revue critique. MVP : pas de review agent séparé |
| Boilerplate (config, scaffold) | Claude Haiku | Rapide, pas cher |

Le routage est géré côté FYREN Backend, pas par le client. Le client voit ses crédits diminuer, pas le modèle utilisé.

---

## 4.6 Evals — Mesurer l'efficacité du contexte

### Test 1 : Qualité UI sans skills vs avec skills
Générer le même composant (dashboard SaaS) avec et sans les skills Tier 1.
Critères : diversité typographique, palette intentionnelle, accessibilité, structure responsive.
Cible : la version avec skills doit être visuellement distinctive et professionnelle.

### Test 2 : Respect des conventions CLAUDE.md
Demander à l'agent de générer 5 composants.
Vérifier : TypeScript strict, imports absolus, structure de fichiers, shadcn/ui, pas de CSS custom.
Cible : > 90% de conformité.

### Test 3 : Non-régression des erreurs
Reprendre les entrées de corrections-log.md.
Poser les mêmes tâches à l'agent.
Cible : 0 erreur reproduite.

### Test 4 : Qualité du CDC généré par l'intake
Faire passer 3 scénarios type (app de réservation, SaaS de facturation, portail copropriétaire).
Vérifier que le CDC couvre : personas, scénarios, comportement, stack, schéma BDD.
Cible : CDC utilisable pour un build sans questions supplémentaires.

---

## Prompt template pour Claude Code (Niveau 1 — builder FYREN)

```
Je veux construire [description de la session].

## ÉTAPE 1 — ORIENTATION
Lis claude-progress.txt pour comprendre l'état actuel.
Lis CLAUDE.md pour les règles et conventions.
Lis docs/corrections-log.md pour les erreurs à ne pas reproduire.

## ÉTAPE 2 — SPECS
[Section pertinente de 02-technical-specs-v2.md]

## ÉTAPE 3 — BUILD
[Liste des tâches spécifiques à cette session]

## ÉTAPE 4 — CLÔTURE
Avant de terminer :
1. Mettre à jour claude-progress.txt
2. Documenter toute erreur corrigée dans corrections-log.md
3. Commit avec message descriptif
```

---

*Livrable conforme à docs/04-context-engineering.md — SaaS Product Factory v3, Phase 4*  
*Double niveau : Niveau 1 (builder FYREN) + Niveau 2 (template apps client)*  
*Prochaine étape : Phase 5 — Distribution des tâches*
