Phase 1 — Définition Produit
Projet : FYREN Platform
Date : 21 mars 2026
1.1 — Problème & Proposition de valeur
Le problème
Le vibe coding a explosé en 2025-2026. Des millions de personnes construisent des apps
avec Lovable, Bolt, Replit. Mais deux réalités les rattrapent :
Réalité #1 — Le prototype ne scale pas. L’app marche en démo. Mais le code vit sur
lovable.app ou bolt.host. Le client ne possède rien. Le jour où il veut un domaine custom, un
backend costaud, ou embaucher un dev pour itérer — il découvre que son “produit” est un
prototype prisonnier d’une plateforme. 90% des projets vibe-codés ne passent jamais en
production.
Réalité #2 — Les crédits brûlent sans cadrage. Le client tape un prompt vague, l’IA
génère du code approximatif, le client itère en boucle pour corriger. Chaque correction brûle
des crédits/tokens. Le coût de debug dépasse souvent le coût de build initial. Le client ne
sait pas quoi demander, et personne ne l’aide à structurer son besoin.
Qui souffre ?
Les builders qui ont un projet Lovable/Bolt qui plafonne et qui cherchent une sortie
Les fondateurs non-tech qui veulent un vrai produit, pas un prototype enfermé
Les freelances/agences qui buildent pour des clients et ont besoin de livrer du code
propre sur l’infra du client
Comment c’est résolu aujourd’hui ?
Lovable/Bolt/Replit : rapide mais lock-in, pas production-ready
Dyad : ownership + open-source, mais app desktop, power-users only, pas de cadrage
Agences : produit sérieux, mais $10-50K et 4-8 semaines

Cursor/Claude Code : puissant mais terminal, zéro UX pour non-devs
Douleur quantifiable :
$25-300/mois de crédits brûlés en itérations non cadrées sur Lovable/Bolt/Replit
$5-15K pour une agency quand le prototype ne scale plus
Des semaines perdues à itérer sur un brief flou
45% du code généré contient des failles de sécurité (pas de specs auth/sécurité en
amont)
La proposition de valeur
En une phrase : FYREN permet aux builders et fondateurs de construire des apps de
production sur leur propre infrastructure (GitHub, Vercel, Supabase, Clerk, Stripe) via une
conversation guidée + preview live, au lieu de vibe coder dans le vide sur une plateforme qui
les enferme.
Moment “wow” : Le client finit la conversation d’intake, clique “Build”, voit son app se
construire en temps réel dans le preview — puis clique “Deploy” et l’app est live sur SON
Vercel, avec SON domaine, depuis SON GitHub. Il ouvre son repo GitHub et voit du code
propre, structuré, documenté. Il réalise : “c’est vraiment à moi.”
Différenciation :
Ce que Lovable ne fait PAS : déployer sur l’infra du client
Ce que Dyad ne fait PAS : tourner dans le browser sans installation
Ce que les agencies ne font PAS : livrer en temps réel avec preview live
Ce que personne ne fait : guider le client via conversation structurée AVANT de coder,
puis builder sur SES comptes
1.2 — Personas & Scénarios d’usage
Persona A — “Le Builder Frustré” (prioritaire)
Nom : Karim, 32 ans, fondateur solo
Contexte : Il a un SaaS sur Lovable depuis 3 mois. Ça marchait bien au début.
Maintenant l’app a 20+ composants, le code se dégrade, les crédits brûlent en debug, et
il réalise qu’il ne peut pas quitter Lovable sans tout reconstruire.

Problème : Son produit est coincé. Il ne peut pas ajouter de logique métier complexe, il
ne peut pas embaucher un dev pour prendre le relais, et son “SaaS” tourne sur
lovable.app au lieu de son propre domaine.
Solution actuelle : Il continue à brûler des crédits sur Lovable en espérant que ça
s’améliore, ou il envisage de tout refaire sur Cursor (mais il n’est pas dev).
Budget : Il paie déjà $25-50/mois pour Lovable. Il paierait plus pour un produit qu’il
possède.
Device : Desktop (laptop)
Citation : “J’aimerais que mon app soit sur MON Vercel, avec MON domaine, et que je
puisse donner le repo à un dev si j’en embauche un.”
Persona B — “Le Client Guidé”
Nom : Sophie, 41 ans, directrice d’une PME de services
Contexte : Elle a une idée d’outil interne pour ses équipes (suivi de projets, facturation,
CRM léger). Elle ne code pas du tout. Elle a entendu parler des AI app builders mais ne
sait pas par où commencer.
Problème : Les formulaires de brief des agencies ne captent pas son besoin. Les
builders comme Lovable l’intimident — “je ne sais même pas quoi taper dans la box.”
Solution actuelle : Elle hésite entre payer une agency ($10K+) ou un freelance Upwork
(risqué).
Budget : $500-2000 pour un MVP, puis itérations mensuelles
Device : Desktop
Citation : “J’aimerais expliquer ce que je veux à quelqu’un qui comprend, et recevoir un
produit fini que je contrôle.”
Persona C — “L’Opérateur” (toi, Omar — dogfooding)
Nom : Omar, fondateur Energyco/FYREN
Contexte : Il utilise FYREN pour builder des apps pour ses clients. Il connaît le
framework v3, il comprend les architectures, il veut aller vite.
Problème : Il veut un outil qui lui permette de livrer des apps de qualité professionnelle
à ses clients, sur l’infra du client, en quelques heures.
Solution actuelle : Claude Code + Claude Swarm + déploiement manuel

Budget : Coût des tokens LLM uniquement
Device : Desktop (Windows + WSL2)
Citation : “J’aimerais un Lovable qui déploie sur l’infra de mon client et qui me coûte
juste les tokens.”
Scénario 1 — Karim migre de Lovable à FYREN
Contexte : Karim a un SaaS de gestion de rendez-vous sur Lovable. L’app plafonne, il veut
migrer.
Actions :
1. Karim arrive sur fyren.app, clique “Nouveau projet”
2. L’agent d’intake démarre : “Salut ! Décris-moi ton projet. Tu pars de zéro ou tu as un
projet existant ?”
3. Karim : “J’ai un SaaS sur Lovable, je veux le migrer sur mon infra”
4. L’agent : “Parfait. Exporte ton code depuis Lovable (GitHub sync), et donne-moi le lien
du repo. Pendant ce temps, décris-moi ce que ton app fait.”
5. Conversation de 10-15 min : l’agent extrait les fonctionnalités, les users, les intégrations,
les pain points actuels
6. L’agent produit le CDC : “Voici ce que je vais construire. Pour ton projet, tu as besoin de
: Supabase (BDD + auth), Stripe (paiements), Vercel (hosting). Crée ces comptes si tu
ne les as pas déjà.”
7. Karim crée les comptes, donne les API keys
8. L’agent lance le build — Karim voit son app se construire en live dans le preview
9. En 30-60 min, l’app est prête. Karim clique “Deploy”
10. L’app est live sur son Vercel, code sur son GitHub, BDD sur son Supabase
Comportement produit :
L’agent analyse le repo Lovable existant pour comprendre la structure
L’agent propose une architecture cible (pas un copier-coller, une reconstruction propre)
L’agent guide la connexion des comptes au bon moment (pas tout d’un coup)
Le preview montre l’app en temps réel pendant le build

Résultat : Karim a son SaaS sur son infra. Il peut itérer avec FYREN ou avec un dev. Il
possède tout.
Métriques : Temps de migration < 2h. Code quality score > 80%. Zéro dépendance à
FYREN post-deploy.
Scénario 2 — Sophie crée son outil interne depuis zéro
Contexte : Sophie veut un outil de suivi de projets pour son équipe de 15 personnes.
Actions :
1. Sophie arrive sur fyren.app, clique “Nouveau projet”
2. L’agent : “Salut ! Dis-moi ce que tu veux construire, comme si tu l’expliquais à un
collègue.”
3. Sophie explique en langage naturel : “Un truc pour suivre nos projets clients, savoir qui
fait quoi, et facturer à la fin du mois”
4. L’agent pose des questions structurées : combien d’utilisateurs ? quels rôles ? quelles
données ? intégration avec des outils existants ?
5. 15 min de conversation. L’agent produit le CDC avec wireframes textuels.
6. L’agent : “Pour ton projet, tu as besoin de GitHub (code), Supabase (BDD + auth), Vercel
(hosting). Je vais te guider pour créer chaque compte.”
7. L’agent guide Sophie étape par étape : “Va sur supabase.com, crée un compte, clique
sur New Project, copie l’API key ici”
8. Build en live. Sophie voit son outil se construire.
9. Deploy. L’outil est live, Sophie partage le lien à son équipe.
Comportement produit :
L’agent traduit le langage business en specs techniques
L’agent ne propose QUE les services nécessaires (pas de Stripe si pas de paiement)
L’agent guide la création de comptes avec des instructions pas-à-pas
L’agent ne code PAS tant que Sophie n’a pas validé le CDC
Résultat : Sophie a un outil custom, hébergé sur son infra, pour le prix des tokens LLM
utilisés.

Métriques : Temps du brief à l’app live < 3h. Sophie ne touche jamais du code. L’app est
utilisable par son équipe dès le jour 1.
Scénario 3 — Omar builde pour un client (dogfooding)
Contexte : Un client syndic demande un portail copropriétaire.
Actions :
1. Omar ouvre FYREN, tape directement le brief (il connaît le framework, pas besoin de
l’intake complet)
2. Il spécifie l’architecture : “React + Supabase + Clerk + Vercel, thème immobilier”
3. Il connecte les comptes du client (le client a créé les comptes en amont, Omar a les API
keys)
4. Build en live. Omar review le code pendant la génération.
5. Omar itère : “Ajoute un système de tickets pour les réclamations”, “Change le thème en
bleu foncé”
6. Deploy sur le Vercel du client. Le client reçoit son portail live.
Comportement produit :
Mode “expert” : pas de questions d’intake si le brief est déjà structuré
Omar peut injecter du contexte métier (normes copro, termes techniques)
Le multi-agent build est transparent : Omar voit quel agent fait quoi
Le code est pushé sur le GitHub du client à chaque étape
Résultat : Omar livre un portail copropriétaire en 2-3h. Le client a son repo GitHub, son
Vercel, son Supabase. Omar peut facturer le service sans que le client soit dépendant.
Métriques : Temps de livraison < 3h. Coût tokens < $10. Marge Omar > 90%.
1.3 — Comportement produit
Le produit est une plateforme de construction assistée
Métaphore humaine : se comporte comme un architecte + maître d’œuvre

L’architecte (l’agent d’intake) écoute le client, dessine les plans, choisit les matériaux. Le
maître d’œuvre (le pipeline de build) construit sur le terrain du client, avec les fournisseurs
du client. À la fin, le client a les clés de SA maison, pas d’un Airbnb.
Règles de comportement :
1. L’agent pose des questions AVANT de coder. Jamais de code sans un CDC validé par
le client.
2. L’agent ne propose QUE les services nécessaires au projet. Un landing page n’a pas
besoin de Stripe et Clerk.
3. L’agent guide la connexion des comptes AU BON MOMENT. Pas un mur de 5 OAuth à
l’entrée. Chaque service est connecté quand le CDC montre qu’il est nécessaire.
4. L’agent montre TOUT ce qu’il fait. Chaque fichier écrit, chaque config modifiée, en
temps réel.
5. Le client peut interrompre et corriger à tout moment. L’agent s’adapte, il ne force
pas.
6. Le client ne code JAMAIS. Si une action nécessite du code, l’agent le fait.
7. Le deploy est sur l’infra du CLIENT. FYREN ne host jamais l’app finale.
8. Le client peut partir quand il veut sans perdre une seule ligne de code.
Exemples concrets :
MAUVAIS : Client : “Je veux une app de réservation” FYREN : génère immédiatement 50
fichiers React
BON : Client : “Je veux une app de réservation” FYREN : “Cool ! C’est pour quel type de
réservation — restaurant, médecin, salle de réunion ? Qui sont tes utilisateurs ?”
MAUVAIS : Écran d’onboarding : “Connectez votre GitHub, Supabase, Clerk, Stripe,
Vercel”
BON : Agent (après le CDC) : “Ton projet a besoin d’une base de données. Je te
recommande Supabase — c’est gratuit pour commencer. Crée un compte sur supabase.com
et donne-moi l’API key. Je m’occupe du reste.”
MAUVAIS : App déployée sur fyren.app/karim-saas
BON : App déployée sur karim-saas.vercel.app → puis karim-saas.com avec le domaine
du client

1.4 — Modèle de pricing
Pay-per-use, zéro abonnement
Le client charge des crédits FYREN. Chaque interaction avec l’IA consomme des crédits.
Sous le capot : FYREN route via OpenRouter (coût réel des tokens) et facture x3.
Action Coût estimé pour le client Coût réel FYREN
Conversation d’intake (15 min) ~$1-3 ~$0.30-1
Build d’une app simple (landing + form) ~$5-15 ~$1.50-5
Build d’un SaaS complet ~$20-50 ~$7-17
Itération (ajout feature) ~$2-10 ~$0.70-3.30
Pourquoi x3 :
x1 = coût OpenRouter (tokens LLM)
x1 = marge pour l’infra FYREN (WebContainers, serveur, CDN)
x1 = marge profit
Pourquoi pas d’abonnement :
Le client paie quand il utilise, pas quand il ne fait rien
Pas de friction “est-ce que je renouvelle ?”
Les clients price-sensitive du vibe coding ($25/mois Lovable) trouvent ça plus honnête
Le client qui build une app à $30 de crédits et ne revient pas dans 3 mois ne paie rien —
et il revient quand il a besoin d’itérer
1.5 — Nom et positionnement
FYREN
Positionnement : “Build it. Own it.”
Tagline : “L’AI app builder qui déploie sur ton infra. Pas la nôtre.”
Message clé : Tu gardes ton code, ton hosting, tes données. FYREN t’aide à construire — tu

possèdes le résultat.
Livrable conforme à docs/01-product-definition.md — SaaS Product Factory v3, Phase 1
Prochaine étape : Phase 2 — Spécifications techniques