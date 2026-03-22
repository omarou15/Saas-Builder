Phase 0 — Recherche & Veille (v2 — Plateforme
SaaS)
Projet : FYREN Platform
Date : 21 mars 2026 | Mise à jour depuis v1 (19 mars 2026)
0.1 — Le concept en une phrase
FYREN est une plateforme SaaS qui build des apps sérieuses sur l’infrastructure du client —
son GitHub, son Clerk, son Stripe, son Supabase, son Vercel. Un agent d’intake
conversationnel structure le besoin en CDC complet, puis un pipeline multi-agent build le
produit directement sur les comptes du client. À la fin, le client possède 100% de son code
et de son infra. Il peut annuler FYREN sans perdre une seule ligne.
Pivot depuis v1 : on passe du service done-for-you (Omar dans la boucle) à une plateforme
self-service (le client est autonome de bout en bout).
Le vrai différenciateur : ce n’est pas l’intake conversationnel (tout le monde peut en
ajouter un). C’est le modèle de propriété. FYREN ne host rien, ne locke personne. Le client
repart avec un produit de production sur ses propres comptes. C’est l’anti-vendor-lock-in
dans un marché construit sur le lock-in.
0.2 — Paysage concurrentiel (mars 2026)
Le marché a explosé depuis notre v1 (19 mars)
Le marché des AI app builders est en hyper-croissance. Lovable a atteint $200M ARR en
moins d’un an. Replit a lancé Agent 4 et un nouveau plan Pro. Le terme “vibe coding” a été
nommé mot de l’année 2025 par Collins Dictionary et classé parmi les “10 Breakthrough
Technologies 2026” par MIT Technology Review. Gartner prédit que 40% du software
d’entreprise sera construit par vibe coding d’ici fin 2026.
Mais deux problèmes fondamentaux persistent :

1. Prompt libre : le client tape sa description, l’IA génère du code. Personne ne structure
le besoin en amont.
2. Vendor lock-in : le code vit sur la plateforme du builder. Le client est locké sur
lovable.app, bolt.host, ou replit.dev. L’export existe sur papier mais le code est tellement
couplé que la migration est un rebuild.
Catégorie A — Leaders établis (prompt → code → lock-in)
Pricing
Concurrent Forces Faiblesses critiques
(2026)
Free 5/jour,
$200M ARR, 8M+
Pro Lock-in : host sur lovable.app,
users, Agent Mode,
$25/mois GitHub sync mais code couplé.
Lovable Figma import,
(100 Crédits brûlés sur debug (0.8-
(lovable.dev) Supabase natif,
crédits), 1.5/cycle), code quality dégradée
Lovable AI (multi-
Business au-delà de 15-20 composants
modèle)
$50/mois
Free 1M
StackBlitz
tokens, Pro
WebContainers, Lock-in : host sur bolt.host. Token
$25/mois
browser-based, burn imprévisible (50K-1M+ par
Bolt.new (10M
open-source prompt selon taille projet),
tokens),
(bolt.diy), Opus 4.6 debugging coûteux
Teams
support
$30/user
Core
$20/mois,
Agent 4 (mars
Pro
2026), parallel Lock-in : host sur replit.dev, BDD
$100/mois
Replit agents, mobile propriétaire. Coûts qui escaladent
(15
apps, effort-based vite ($65-300/mois réaliste)
builders),
pricing
Enterprise
custom
Catégorie B — Challengers & nouveaux entrants (même modèle)
Concurrent Pricing Positionnement Lock-in & pertinence FYREN
“AI Advisor” =
Lock-in : host sur Shipper. Export
Free limité,
copilote
React/TS propre mais migration
Pro
Shipper.now business

~$25/mois intégré manuelle. Le plus proche de notre vision
côté conseil. ~$4.2K MRR
Free 25
Lock-in : export code seulement sur
msg/mois, Backend natif,
Base44 plan Builder ($40/mois+). Wix va
$16- acquis par Wix
renforcer l’enfermement.
160/mois
Free limité, Code quality
Lock-in : host sur Blink. Se différencie
Blink.new plans supérieure vs
sur la fiabilité, pas sur l’ownership.
payants Lovable
Le moins cher,
Hostinger Lock-in total : pas de backend natif, pas
$6.99/mois écosystème
Horizons d’export code. Le plus enfermant.
Hostinger
Full-stack +
Famous.ai N/A Lock-in : host sur Famous. Émergent.
mobile
Catégorie C — IDE + IA (pour développeurs)
Outil Pricing Note
Free, Pro
Cursor IDE pur, pas un builder no-code. Référence pour les devs.
$20/mois
Windsurf Pro $15/mois Cascade mode, bon rapport qualité/prix. IDE, pas self-service.
Claude Via API Terminal agent, le plus puissant pour le build structuré. C’est
Code Anthropic notre moteur interne.
0.3 — Les deux problèmes systémiques du marché
Problème #1 : le “cold start” — pas de cadrage avant le code
Le workflow de chaque concurrent est identique :
1. Le client arrive avec une idée vague
2. Il tape un prompt dans une text box
3. L’IA génère du code

4. Le client itère par essai-erreur (brûle des crédits/tokens)
5. Le résultat ressemble à ce que l’IA a compris, pas à ce que le client voulait
Conséquences documentées :
45% du code IA contient des failles de sécurité (Veracode 2024)
90% des projets IA ne passent jamais en production (NYC Today, mars 2026)
La dette technique AI pourrait atteindre $1.5T d’ici 2027 (Fast Company 2024)
Les développeurs sont 19% plus lents avec les outils IA quand le contexte n’est pas
structuré (METR, juillet 2025)
Le code se dégrade au-delà de 15-20 composants — l’IA perd le contexte (multiple
sources)
Les coûts de debugging dépassent souvent le coût de construction initiale
Problème #2 : le vendor lock-in — le client ne possède rien
Tous les builders hébergent le produit du client sur leur propre infra :
Lovable → lovable.app (GitHub sync mais code couplé à leur stack)
Bolt → bolt.host (WebContainers, pas standard)
Replit → replit.dev (BDD propriétaire, secrets liés)
Base44 → export code payant ($40/mois+), Wix va renforcer l’enfermement
Hostinger Horizons → pas d’export du tout
Conséquence : le client ne peut pas quitter la plateforme sans rebuild. Il n’a pas un
“produit”, il a un “abonnement à un prototype”. Le jour où il veut scaler, changer de stack, ou
embaucher un dev, il repart de zéro.
C’est le business model de tous les concurrents : la rétention par le lock-in, pas par la
valeur.
L’intake conversationnel, tout le monde peut l’ajouter. L’ownership client sur son infra,
personne ne le fera — ça casse le modèle de revenus récurrents classique.
0.4 — L’opportunité FYREN
Le vrai différenciateur : le client possède tout, sur son infra

FYREN ne host rien. FYREN configure le système du client :
CE QUE LE CLIENT CONNECTE CE QUE FYREN FAIT
─────────────────────────── ──────────────────────────
Son GitHub ← Push le code, structure le repo
Son Clerk ← Configure l'auth, les rôles, le SSO
Son Stripe ← Setup les plans, webhooks, portail client
Son Supabase ← Crée le schema, les RLS, les fonctions edge
Son Vercel / Railway / Fly.io ← Configure le déploiement, les env vars
Son OpenRouter ← Setup le routage LLM si l'app utilise de l'IA
À la fin, le client peut annuler FYREN et ne perd rien. Le code est sur son GitHub. L’auth
est sur son Clerk. Les paiements sont sur son Stripe. Le déploiement est sur son Vercel.
C’est contre-intuitif en SaaS, mais c’est précisément ce qui crée :
La confiance : le client sait qu’il n’est pas piégé → conversion plus facile
Le bouche-à-oreille : “j’ai un vrai produit, pas un prototype sur une plateforme”
La rétention par la valeur : le client reste parce que FYREN l’aide à itérer, pas parce
qu’il est prisonnier
L’intake conversationnel reste le véhicule
L’agent d’intake est un consultant produit IA qui :
Pose les bonnes questions dans le bon ordre (inspiré du SaaS Product Factory v3)
Extrait le persona, les scénarios d’usage, le comportement produit attendu
Identifie les contraintes (budget, timeline, stack préféré)
Produit un CDC structuré et lisible AVANT de lancer le build
Guide le client dans la connexion de ses comptes (GitHub, Clerk, Stripe, Supabase,
hébergeur)
Mais l’intake n’est pas le moat. Le moat c’est que le output est un produit sérieux, sur l’infra
du client, qu’il peut donner à ses propres clients.
Validation de l’hypothèse (acquis de notre v1)
L’agent Alex (Chatbase) extrait un brief de meilleure qualité qu’un formulaire
Le skill v3 bloque correctement quand le domaine est niche (Phase 0.5)
Le workflow CDC → multi-agent build fonctionne en 3 prompts + 1 correction

Un client test a produit un brief utilisable en 15 min de conversation
Positionnement prix
Segment Prix/mois Ce que le client obtient
Lovable/Bolt $25-50 Code sur LEUR plateforme, host sur LEUR domaine
Replit Pro $100 IDE puissant, mais host/BDD propriétaire
Agency $5-15K
Code livré, mais 4-8 semaines + pas de support post
traditionnelle one-shot
$39-99 Code sur SON GitHub, auth sur SON Clerk, deploy sur SON
FYREN
(cible) Vercel. Produit de production qu’il possède.
FYREN ne vend pas de l’hébergement ni des crédits. FYREN vend de la configuration
d’infrastructure + du cadrage produit. Le client paie pour que son système soit construit
correctement sur ses propres comptes. La valeur est dans le setup et l’itération, pas dans le
lock-in.
0.5 — Recherche technique & état de l’art
Multi-agent orchestration (mars 2026)
L’écosystème multi-agent a mûri significativement :
Claude Code Agent Teams (expérimental) : teammates avec contextes indépendants et
communication directe
Claude Swarm : dependency graph + Quality Gate Opus
Replit Agent 4 : parallel agents pour frontend/backend/tests simultanés
MCP (Model Context Protocol) : standard ouvert, 1000+ serveurs communautaires,
adopté par OpenAI
A2A (Agent2Agent, Google) : communication inter-agents asynchrone
FYREN peut construire sur Claude Code + Swarm pour le build engine, et exposer une
interface conversationnelle propre pour l’intake.
Problèmes connus du vibe coding — et comment FYREN les résout

Problème Cause racine Comment FYREN le résout
Code qui marche en
Pas de specs sur les L’agent d’intake pose des questions sur
démo mais pas en
edge cases les cas limites
prod
Coûts de debug > Specs vagues → CDC structuré = scope clair = moins
coûts de build itérations infinies d’itérations
Sécurité (45% de L’IA génère le happy Le CDC inclut auth, rôles, RLS dès le
failles) path départ (Phase 2 du skill v3)
Context rot au-delà
Fenêtre de contexte Architecture découpée dans le CDC →
de 15-20
saturée agents spécialisés par module (ISOLATE)
composants
Dette technique Code généré sans Le CDC impose l’architecture avant le
$1.5T projetée architecture code
Code + host sur la
Tout est sur l’infra du client — GitHub,
Vendor lock-in plateforme du
Clerk, Stripe, Supabase, Vercel
builder
Plateforme du Le client est sur des services de
Pas scalable builder a ses production standard — scale
propres limites naturellement
Impossible Repo GitHub standard, stack
Code couplé à la
d’embaucher un mainstream — n’importe quel dev peut
plateforme
dev reprendre
Score de niche (Phase 0.5 du skill v3)
Le domaine a-t-il des formats propriétaires ? 0 (non)
Le domaine est-il réglementé ? 0 (non)
Y a-t-il moins de 100 repos GitHub sur le sujet ? 0 (non — l'app building est mainstream)
Le LLM se trompe sur les détails techniques ? 0 (non — c'est son terrain)
Les données d'entraînement datent sur ce domaine ? 0 (non)
Le domaine évolue rapidement ? +1 (oui — l'écosystème change chaque semaine)
Score : 1/10 → Phase 0.5 OPTIONNELLE
Le domaine est mainstream — pas besoin de base de connaissances métier lourde. Un
CLAUDE.md solide suffira.

0.6 — Risques techniques majeurs
Risque Probabilité Impact Mitigation
Templates structurés par type de
L’agent d’intake ne
projet + questions de relance +
capture pas assez de Moyenne Critique
possibilité d’ajouter des
détails
screenshots/mockups
Le build automatique Quality Gate multi-agent (architecte
produit du code de Haute Élevé → builders → reviewer), corrections-
mauvaise qualité log, gold data
Le marché évolue trop Exécuter vite. L’avantage n’est pas
vite (Lovable ajoute un Haute Élevé l’idée, c’est le framework v3 intégré
intake demain) et la profondeur du CDC
Le pricing self-service ne Freemium (1 projet gratuit) + pricing
matche pas la valeur Moyenne Moyen basé sur la valeur du CDC (pas sur
perçue les crédits/tokens)
Routage tiered (Haiku pour
Scalabilité du build boilerplate, Sonnet pour logique,
Moyenne Élevé
engine (coûts API Claude) Opus pour architecture), cache de
patterns communs
Dépendance à Anthropic Abstraire le LLM provider → support
Faible Élevé
(pannes, pricing) multi-modèle (Claude, GPT, Gemini)
0.7 — Décision Go / No-Go
Arguments GO
1. Moat structurel, pas feature : le client possède son code, son infra, ses comptes. Les
concurrents ne peuvent pas copier ça — ça casse leur business model de rétention par
lock-in.
2. Marché en hyper-croissance : Lovable $200M ARR en <1 an. Le TAM du vibe coding
est massif et en accélération.
3. Le problème est réel et chiffré : 90% des projets IA ne passent pas en prod, 45% ont

des failles de sécurité, dette technique projetée à $1.5T.
4. L’intake conversationnel est validé : notre agent Alex a prouvé qu’une conversation de
15 min produit un meilleur brief qu’un formulaire.
5. Le framework v3 est un asset unique : 9 phases structurées, context engineering
intégré, pas reproductible facilement.
6. La confiance par l’ownership accélère la conversion : “tu peux annuler et garder tout”
est l’argument de vente le plus puissant dans un marché de méfiance envers le lock-in.
7. Le client peut scaler : stack standard (Next.js/React, Supabase, Clerk, Stripe, Vercel) →
n’importe quel dev peut reprendre. Ça ouvre le marché aux clients sérieux, pas juste aux
prototypeurs.
8. Phase 0.5 optionnelle : le domaine est mainstream, on peut aller vite.
Arguments vigilance
1. Complexité technique du setup multi-comptes — configurer GitHub + Clerk + Stripe
+ Supabase + Vercel de manière automatisée est un défi d’ingénierie (MCP, OAuth, API
keys)
2. La concurrence est massivement financée — Lovable $228M levés, Replit $105M
3. Le self-service est plus dur que le done-for-you — le client non-tech doit créer ses
comptes et connecter ses services
4. Le modèle de rétention doit être réinventé — si le client peut partir, pourquoi
resterait-il ? La valeur d’itération et de maintenance doit être évidente.
5. L’onboarding est plus complexe — créer un compte Supabase + Clerk + Stripe
demande plus d’effort qu’un simple login sur Lovable
DÉCISION : GO
Le moat est structurel. Les builders actuels sont construits sur le lock-in — ils ne peuvent
pas pivoter vers l’ownership sans casser leurs revenus. C’est comme si Uber construisait un
service qui aide les chauffeurs à devenir indépendants : le business model ne le permet pas.
FYREN peut le faire parce que FYREN ne host rien. Le revenu vient de la valeur de cadrage
(intake + CDC) et de l’itération (maintenance + nouvelles features), pas de l’hébergement.
Le jour où le client n’a plus besoin de FYREN, c’est un succès pour FYREN — et il
recommandera le service.
Facteur temps : exécuter dans les 3 prochains mois. Le window est ouvert tant que les
leaders sont enfermés dans leur modèle de lock-in.

0.8 — Prochaine étape : Phase 1 — Définition Produit
À définir :
Persona principal précis (non-tech founder ? freelance ? PME ? agence ?)
3 scénarios d’usage (du premier contact avec l’agent → connexion des comptes → build
→ déploiement sur son infra)
Comportement produit détaillé (l’agent d’intake + le setup des comptes + le build + la
livraison sur l’infra client)
UX de l’onboarding multi-comptes (comment rendre la connexion
GitHub/Clerk/Stripe/Supabase/Vercel fluide)
Modèle de pricing détaillé (sur quoi le client paie exactement si on ne host rien)
Stratégie de rétention sans lock-in (pourquoi le client reste)
Livrable conforme à docs/00-research.md — SaaS Product Factory v3, Phase 0 Capital
acquis de la v1 (19 mars) intégré et enrichi avec recherche actualisée (21 mars) Pivot
stratégique : ownership client comme moat structurel (21 mars)