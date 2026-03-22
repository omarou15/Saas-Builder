---
name: animated-landing-page
description: Crée des landing pages dynamiques, animées et visuellement premium — avec scroll-jacking, transitions de sections, parallax, révélations au scroll, sliders/carousels, effets de particules, counter animés, et micro-interactions. Utilise ce skill SYSTÉMATIQUEMENT dès que l'utilisateur mentionne une landing page, page d'accueil, hero section, page marketing, ou demande des animations, transitions, slides, effets visuels, ou une page "non statique". Ne jamais créer une landing page sans consulter ce skill. Une landing statique sans animation est un anti-pattern à éviter absolument.
---

# Animated Landing Page Skill

Ce skill guide la création de landing pages modernes, dynamiques et animées. L'objectif : produire des pages qui donnent une impression premium, engagent l'utilisateur dès les premières secondes, et convertissent.

## 0. Stack recommandé par défaut

| Contexte | Stack recommandé |
|---|---|
| Next.js / React existant | Framer Motion + GSAP ScrollTrigger |
| Vite + React | Framer Motion + GSAP ScrollTrigger |
| HTML/CSS vanilla | GSAP + CSS custom properties |
| Besoin ultra-léger | CSS animations + Intersection Observer |

### Librairies à connaître

- `framer-motion` → animations React déclaratives, layout animations, page transitions
- `gsap` + `@gsap/react` + `ScrollTrigger` → scroll-jacking avancé, timelines complexes
- `lenis` → smooth scroll inertiel (remplace locomotive-scroll, plus léger)
- `react-intersection-observer` → révélations au scroll simples
- `swiper` → sliders/carousels premium avec transitions 3D
- `three.js` ou `@react-three/fiber` → backgrounds 3D interactifs (si demandé)
- `canvas-confetti` → effets de célébration ponctuels

## 1. Architecture d'une landing animée

### Structure de sections (ordre standard)

```
[HERO] → [SOCIAL PROOF] → [FEATURES] → [HOW IT WORKS] → [TESTIMONIALS] → [PRICING] → [CTA FINAL]
```

### Règle fondamentale : chaque section a sa propre "entrée"

Chaque section doit révéler son contenu de façon distincte. Ne jamais laisser une section apparaître instantanément sans transition. Types d'entrées :

- **Fade up** : élément monte de 40px en opacité 0→1
- **Clip reveal** : texte révélé par un masque glissant
- **Scale in** : élément grossit de 0.8 à 1.0
- **Stagger** : enfants apparaissent les uns après les autres (délai 100-150ms)
- **Split text** : chaque mot/lettre animé séparément

## 2. Hero Section (section critique)

Le hero doit captiver en moins de 2 secondes. Pattern obligatoire :

```jsx
const heroVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.2 }
  }
}

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } }
}
```

### Options hero avancées

- **Typing effect** : texte qui se tape lettre par lettre (`useEffect` + `setInterval`)
- **Word rotation** : mot clé qui change en boucle avec transition (ex: "rapide" → "intelligent" → "puissant")
- **Gradient animé** : background-gradient qui se déplace lentement
- **Particules** : points/formes géométriques en mouvement lent
- **Video loop** : vidéo muette en arrière-plan avec overlay
- **Mesh gradient** : blobs de couleur animés en CSS pur

## 3. Scroll Animations (GSAP ScrollTrigger)

### Setup de base (à faire UNE seule fois)

```jsx
import { useEffect } from 'react'
import gsap from 'gsap'
import ScrollTrigger from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

// Smooth scroll avec Lenis
import Lenis from 'lenis'

const lenis = new Lenis()
function raf(time) {
  lenis.raf(time)
  requestAnimationFrame(raf)
}
requestAnimationFrame(raf)

// Connecter Lenis à GSAP ScrollTrigger
lenis.on('scroll', ScrollTrigger.update)
gsap.ticker.add((time) => lenis.raf(time * 1000))
gsap.ticker.lagSmoothing(0)
```

### Patterns ScrollTrigger courants

**Révélation de section :**

```js
gsap.from('.feature-card', {
  scrollTrigger: {
    trigger: '.features-section',
    start: 'top 80%',
    end: 'bottom 20%',
    toggleActions: 'play none none reverse'
  },
  y: 60,
  opacity: 0,
  duration: 0.8,
  stagger: 0.15,
  ease: 'power3.out'
})
```

**Parallax background :**

```js
gsap.to('.hero-bg', {
  scrollTrigger: {
    trigger: '.hero',
    start: 'top top',
    end: 'bottom top',
    scrub: 1.5
  },
  y: '30%'
})
```

**Texte horizontal scroll (marquee) :**

```js
gsap.to('.marquee-inner', {
  x: '-50%',
  duration: 20,
  repeat: -1,
  ease: 'none'
})
```

**Counter animé :**

```js
gsap.to(counter, {
  scrollTrigger: { trigger: counter, start: 'top 85%' },
  innerText: targetValue,
  duration: 2,
  snap: { innerText: 1 },
  ease: 'power2.out'
})
```

## 4. Transitions entre sections

### Transition slide full-page (scroll-jacking complet)

Utiliser uniquement si le design l'exige (ex: portfolio premium, présentation produit) :

```js
const sections = gsap.utils.toArray('.panel')
sections.forEach((section, i) => {
  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    pin: true,
    pinSpacing: false
  })
})
```

### Transition douce entre sections (recommandé par défaut)

CSS seul suffit pour la plupart des cas :

```css
.section {
  opacity: 0;
  transform: translateY(40px);
  transition: opacity 0.7s cubic-bezier(0.22, 1, 0.36, 1),
              transform 0.7s cubic-bezier(0.22, 1, 0.36, 1);
}
.section.is-visible {
  opacity: 1;
  transform: translateY(0);
}
```

Avec Intersection Observer :

```js
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('is-visible')
  })
}, { threshold: 0.15 })

document.querySelectorAll('.section').forEach(s => observer.observe(s))
```

## 5. Slider / Carousel

### Swiper.js (recommandé)

```jsx
import { Swiper, SwiperSlide } from 'swiper/react'
import { EffectFade, Autoplay, Navigation, Pagination } from 'swiper/modules'

<Swiper
  modules={[EffectFade, Autoplay, Navigation, Pagination]}
  effect="fade"
  speed={800}
  autoplay={{ delay: 4000, disableOnInteraction: false }}
  loop
>
  {slides.map(slide => (
    <SwiperSlide key={slide.id}>
      {/* contenu */}
    </SwiperSlide>
  ))}
</Swiper>
```

### Effets Swiper disponibles

- `fade` → fondu simple, propre
- `cube` → cube 3D rotatif
- `flip` → retournement de carte
- `coverflow` → effet galerie en profondeur
- `cards` → cartes empilées (idéal pour témoignages)

## 6. Micro-interactions & Hover

### Boutons CTA (obligatoire sur tout CTA principal)

```css
.cta-button {
  position: relative;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.cta-button::after {
  content: '';
  position: absolute;
  inset: 0;
  background: rgba(255,255,255,0.15);
  transform: translateX(-100%);
  transition: transform 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.cta-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 20px 40px rgba(0,0,0,0.2);
}

.cta-button:hover::after {
  transform: translateX(0);
}
```

### Cards avec effet 3D tilt (optionnel, premium)

```js
element.addEventListener('mousemove', (e) => {
  const rect = element.getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width - 0.5
  const y = (e.clientY - rect.top) / rect.height - 0.5
  element.style.transform = `perspective(600px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`
})
element.addEventListener('mouseleave', () => {
  element.style.transform = 'perspective(600px) rotateY(0) rotateX(0)'
})
```

## 7. Backgrounds animés (sans librairie)

### Gradient mesh animé (CSS pur)

```css
.animated-bg {
  background: linear-gradient(-45deg, #ee7752, #e73c7e, #23a6d5, #23d5ab);
  background-size: 400% 400%;
  animation: gradientShift 15s ease infinite;
}

@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
```

### Blobs CSS (formes organiques animées)

```css
.blob {
  border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%;
  animation: morphing 8s ease-in-out infinite;
  filter: blur(40px);
  opacity: 0.4;
}

@keyframes morphing {
  0%, 100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; }
  50% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; }
}
```

### Grid pattern (SVG background)

```css
.grid-bg {
  background-image: url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.08'%3E%3Cpath d='M0 40L40 0H20L0 20M40 40V20L20 40'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
}
```

## 8. Performance (règles impératives)

- `will-change: transform` uniquement sur les éléments qui bougent vraiment
- `transform` et `opacity` uniquement pour les animations (jamais `width`, `height`, `top`, `left`)
- Désactiver les animations en mobile si trop lourdes :

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

- Lazy load les images below-the-fold : `loading="lazy"`
- GSAP ScrollTrigger : toujours `kill()` les triggers dans le cleanup React (`useEffect` return)

## 9. Checklist avant livraison

- [ ] Hero animé dès le chargement (stagger + fade-up minimum)
- [ ] Toutes les sections ont une révélation au scroll
- [ ] Smooth scroll activé (Lenis ou CSS `scroll-behavior: smooth`)
- [ ] CTAs ont un effet hover
- [ ] Pas d'animation sur `prefers-reduced-motion`
- [ ] Performance OK sur mobile (throttle si nécessaire)
- [ ] Aucune animation ne bloque le rendu initial (LCP préservé)
- [ ] GSAP ScrollTrigger cleanup dans les `useEffect`

## 10. Références visuelles

Pour calibrer le niveau attendu, viser l'esthétique de :

- **linear.app** → transitions fluides, minimal, scroll très propre
- **framer.com** → animations sophistiquées, révélations créatives
- **stripe.com** → gradients premium, micro-interactions soignées
- **vercel.com** → dark mode, particules, typographie bold
- **lottiefiles.com** → animations Lottie intégrées

## 11. Commande de démarrage rapide

Quand l'utilisateur dit "crée une landing", demander ou inférer :

1. Quel produit ? (nom, tagline)
2. Stack ? (Next.js, Vite, HTML pur)
3. Style ? (dark/light, minimaliste/riche, couleur dominante)
4. Sections nécessaires ? (hero + features + pricing + CTA minimum)

Puis démarrer avec le scaffold suivant :

```
src/
  components/
    landing/
      Hero.tsx         → hero animé avec Framer Motion
      Features.tsx     → cards avec reveal au scroll
      HowItWorks.tsx   → étapes animées
      Testimonials.tsx → slider Swiper
      Pricing.tsx      → cards avec highlight animé
      CTA.tsx          → section finale avec effet de fond
  hooks/
    useScrollAnimation.ts  → hook réutilisable Intersection Observer
  lib/
    gsap.ts                → config GSAP + Lenis centralisée
```
