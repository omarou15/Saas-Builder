# Corrections Log — FYREN

## 21 mars 2026 — Skills UI/UX obligatoires
**Contexte** : Build d'apps client avec Claude Code
**Erreur** : Claude Code sans skills UI produit du "AI slop" — interfaces génériques (Inter, gradient violet, cards en grid), pas pro
**Correction** : Pré-embarquer les skills Frontend Design (Anthropic), React Best Practices (Vercel), Web Design Guidelines (Vercel), Composition Patterns (Vercel) dans chaque sandbox
**Cause** : Convergence distributionnelle — le modèle reproduit le centre statistique des décisions de design sans guidance explicite
**Règle** : TOUJOURS inclure les skills Tier 1 dans l'image sandbox E2B. Ne JAMAIS lancer un build client sans skills UI/UX activés.
