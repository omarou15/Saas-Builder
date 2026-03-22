"use client";

import { useRef } from "react";
import Link from "next/link";
import {
  motion,
  useScroll,
  useTransform,
  useInView,
  useSpring,
} from "framer-motion";
import {
  ArrowRight,
  Github,
  Globe,
  Database,
  Shield,
  Zap,
  Code2,
  Eye,
  Rocket,
  Lock,
  Unlock,
  CreditCard,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { AnimatedCounter } from "@/components/landing/animated-counter";
import { TypingCode } from "@/components/landing/typing-code";
import { PreviewMockup } from "@/components/landing/preview-mockup";
import { CodeRain } from "@/components/landing/code-rain";

/* ──────────────────────────────────────────────
   Reusable animation wrappers
   ────────────────────────────────────────────── */

function FadeUp({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function ScaleIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={isInView ? { opacity: 1, scale: 1 } : {}}
      transition={{ duration: 0.6, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ──────────────────────────────────────────────
   HERO SECTION
   ────────────────────────────────────────────── */

function HeroSection() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const y = useTransform(scrollYProgress, [0, 1], [0, 200]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <section
      ref={ref}
      className="noise-bg relative flex min-h-screen items-center justify-center overflow-hidden"
    >
      <CodeRain className="opacity-40" />

      {/* Radial gradient glow */}
      <div className="absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[600px] w-[600px] rounded-full bg-orange-500/10 blur-[120px]" />
      </div>

      <motion.div
        style={{ y, opacity }}
        className="relative z-10 mx-auto max-w-5xl px-6 text-center"
      >
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/5 px-4 py-1.5 text-sm text-orange-400"
        >
          <Zap className="h-3.5 w-3.5" />
          AI-powered app builder
        </motion.div>

        {/* Main headline */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-5xl font-bold leading-[1.1] tracking-tight sm:text-7xl lg:text-8xl"
        >
          Build it.{" "}
          <span className="fyren-text-gradient">Own it.</span>
        </motion.h1>

        {/* Tagline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.6 }}
          className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl"
        >
          L&apos;AI app builder qui d&eacute;ploie sur{" "}
          <span className="font-semibold text-foreground">ton infra</span>.
          Pas la n&ocirc;tre.
        </motion.p>

        {/* Sub-tagline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.8 }}
          className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground/70"
        >
          GitHub &middot; Vercel &middot; Supabase &middot; Clerk &middot;
          Stripe &mdash; ton code, ton hosting, tes donn&eacute;es.
        </motion.p>

        {/* CTA buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
        >
          <Link
            href="/sign-up"
            className="fyren-glow group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-4 text-base font-semibold text-white transition-all hover:from-orange-400 hover:to-orange-500 hover:shadow-lg hover:shadow-orange-500/25"
          >
            Start building
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <Link
            href="#how-it-works"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-8 py-4 text-base font-medium text-foreground transition-all hover:border-white/20 hover:bg-white/10"
          >
            Comment &ccedil;a marche
            <ChevronRight className="h-4 w-4" />
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 1.3 }}
          className="mt-16 flex items-center justify-center gap-8 text-sm text-muted-foreground sm:gap-16"
        >
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">
              <AnimatedCounter target={100} suffix="%" />
            </div>
            <div>Ownership</div>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">
              <AnimatedCounter target={0} prefix="$" suffix="/mo" />
            </div>
            <div>Pas d&apos;abo</div>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">
              &lt;<AnimatedCounter target={3} suffix="h" />
            </div>
            <div>App live</div>
          </div>
        </motion.div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="h-10 w-6 rounded-full border-2 border-white/20 p-1"
        >
          <div className="h-2 w-full rounded-full bg-orange-500/60" />
        </motion.div>
      </motion.div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   PROBLEM SECTION — Lock-in visual
   ────────────────────────────────────────────── */

function ProblemSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section
      ref={ref}
      className="relative overflow-hidden border-t border-white/5 py-32"
    >
      <div className="mx-auto max-w-6xl px-6">
        <FadeUp>
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-orange-400">
            Le probl&egrave;me
          </p>
          <h2 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
            Ton app est{" "}
            <span className="text-red-400">prisonni&egrave;re</span>{" "}
            d&apos;une plateforme.
          </h2>
        </FadeUp>

        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {[
            {
              icon: Lock,
              title: "Lock-in",
              desc: "Ton code vit sur lovable.app ou bolt.host. Tu ne poss\u00e8des rien. Le jour o\u00f9 tu veux un domaine custom \u2014 tu d\u00e9couvres que ton \u201cproduit\u201d est un prototype prisonnier.",
              color: "text-red-400",
              borderColor: "border-red-500/20",
              bgColor: "bg-red-500/5",
            },
            {
              icon: CreditCard,
              title: "Cr\u00e9dits br\u00fbl\u00e9s",
              desc: "Prompt vague \u2192 code approximatif \u2192 it\u00e9rations en boucle. Le co\u00fbt de debug d\u00e9passe le co\u00fbt de build. $25-300/mois br\u00fbl\u00e9s sans cadrage.",
              color: "text-yellow-400",
              borderColor: "border-yellow-500/20",
              bgColor: "bg-yellow-500/5",
            },
            {
              icon: Shield,
              title: "Pas production-ready",
              desc: "45% du code g\u00e9n\u00e9r\u00e9 contient des failles de s\u00e9curit\u00e9. Pas de specs auth en amont. Le prototype ne scale pas.",
              color: "text-orange-400",
              borderColor: "border-orange-500/20",
              bgColor: "bg-orange-500/5",
            },
          ].map((card, i) => (
            <FadeUp key={card.title} delay={i * 0.15}>
              <div
                className={`group relative h-full rounded-2xl border ${card.borderColor} ${card.bgColor} p-8 transition-all duration-500 hover:border-white/10`}
              >
                <card.icon className={`mb-4 h-8 w-8 ${card.color}`} />
                <h3 className="mb-3 text-xl font-semibold">{card.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {card.desc}
                </p>
              </div>
            </FadeUp>
          ))}
        </div>

        {/* Breaking chains animation */}
        <motion.div
          className="mt-20 flex items-center justify-center gap-4"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 1, delay: 0.6 }}
        >
          <motion.div
            animate={
              isInView
                ? { x: [-20, 0], rotate: [-10, 0], opacity: [0.5, 0.2] }
                : {}
            }
            transition={{ duration: 1.5, delay: 0.8 }}
          >
            <Lock className="h-10 w-10 text-red-400/30" />
          </motion.div>
          <motion.div
            className="flex items-center gap-1"
            animate={isInView ? { scaleX: [1, 1.2, 0], opacity: [0.3, 0.5, 0] } : {}}
            transition={{ duration: 1.5, delay: 0.8 }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-0.5 w-3 rounded-full bg-red-400/30" />
            ))}
          </motion.div>
          <motion.div
            animate={isInView ? { scale: [0.8, 1.2, 1] } : {}}
            transition={{ duration: 0.8, delay: 2 }}
          >
            <Unlock className="h-12 w-12 text-orange-400" />
          </motion.div>
          <motion.div
            className="flex items-center gap-1"
            animate={isInView ? { scaleX: [0, 1], opacity: [0, 0.5, 1] } : {}}
            transition={{ duration: 1, delay: 2.3 }}
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-0.5 w-3 rounded-full bg-orange-400/50"
              />
            ))}
          </motion.div>
          <motion.div
            animate={isInView ? { x: [20, 0], opacity: [0, 1] } : {}}
            transition={{ duration: 0.8, delay: 2.5 }}
            className="text-lg font-bold text-orange-400"
          >
            Libert&eacute;.
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   SOLUTION SECTION — Step-by-step
   ────────────────────────────────────────────── */

function SolutionSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 0.8", "end 0.3"],
  });
  const lineHeight = useSpring(useTransform(scrollYProgress, [0, 1], [0, 100]), {
    stiffness: 100,
    damping: 30,
  });

  const steps = [
    {
      icon: MessageSquare,
      title: "1. D\u00e9cris ton projet",
      desc: "L\u2019agent d\u2019intake te pose les bonnes questions. En 15 min, tu as un cahier des charges structur\u00e9 \u2014 pas un prompt vague.",
      detail: "Conversation guid\u00e9e \u2192 CDC valid\u00e9",
    },
    {
      icon: Code2,
      title: "2. Regarde-le se construire",
      desc: "L\u2019agent code ton app en temps r\u00e9el. Tu vois chaque fichier, chaque composant appara\u00eetre dans le preview live.",
      detail: "Build en live \u2192 Preview instant",
    },
    {
      icon: Rocket,
      title: "3. D\u00e9ploie sur TON infra",
      desc: "Un clic. Ton code est sur ton GitHub, ton app sur ton Vercel, ta BDD sur ton Supabase. Tu poss\u00e8des tout.",
      detail: "Deploy \u2192 100% ownership",
    },
  ];

  return (
    <section
      id="how-it-works"
      ref={containerRef}
      className="relative border-t border-white/5 py-32"
    >
      <div className="mx-auto max-w-6xl px-6">
        <FadeUp>
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-orange-400">
            Comment &ccedil;a marche
          </p>
          <h2 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
            3 &eacute;tapes.{" "}
            <span className="text-muted-foreground">Z&eacute;ro code.</span>
          </h2>
        </FadeUp>

        <div className="relative mt-20">
          {/* Animated progress line */}
          <div className="absolute left-8 top-0 hidden h-full w-px bg-white/5 md:block">
            <motion.div
              className="w-full origin-top bg-gradient-to-b from-orange-500 to-orange-500/0"
              style={{ height: `${lineHeight.get()}%` }}
            />
          </div>

          <div className="space-y-20">
            {steps.map((step, i) => (
              <FadeUp key={step.title} delay={i * 0.1}>
                <div className="flex gap-8 md:gap-12">
                  {/* Step icon */}
                  <div className="relative hidden shrink-0 md:block">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10">
                      <step.icon className="h-7 w-7 text-orange-400" />
                    </div>
                  </div>

                  {/* Step content */}
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3 md:hidden">
                      <step.icon className="h-5 w-5 text-orange-400" />
                      <span className="text-xs font-medium text-orange-400">
                        {step.detail}
                      </span>
                    </div>
                    <h3 className="mb-3 text-2xl font-bold">{step.title}</h3>
                    <p className="max-w-xl text-base leading-relaxed text-muted-foreground">
                      {step.desc}
                    </p>
                    <div className="mt-3 hidden text-sm font-medium text-orange-400/80 md:block">
                      {step.detail}
                    </div>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   DEMO SECTION — Live build visualization
   ────────────────────────────────────────────── */

function DemoSection() {
  return (
    <section className="relative overflow-hidden border-t border-white/5 py-32">
      {/* Background glow */}
      <div className="absolute right-0 top-1/2 -translate-y-1/2">
        <div className="h-[500px] w-[500px] rounded-full bg-orange-500/5 blur-[100px]" />
      </div>

      <div className="mx-auto max-w-6xl px-6">
        <FadeUp>
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-orange-400">
            D&eacute;mo
          </p>
          <h2 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl">
            Regarde ton app se{" "}
            <span className="fyren-text-gradient">construire</span>.
          </h2>
          <p className="mt-4 max-w-xl text-muted-foreground">
            L&apos;agent code. Le preview se met &agrave; jour en temps
            r&eacute;el. Tu vois chaque ligne appara&icirc;tre.
          </p>
        </FadeUp>

        <div className="mt-16 grid gap-8 lg:grid-cols-2">
          <FadeUp delay={0.1}>
            <TypingCode className="h-full" />
          </FadeUp>
          <FadeUp delay={0.2}>
            <PreviewMockup className="h-full" />
          </FadeUp>
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   FEATURES / STACK SECTION
   ────────────────────────────────────────────── */

function FeaturesSection() {
  const features = [
    {
      icon: Github,
      title: "GitHub",
      desc: "Ton code dans ton repo. Push automatique, CI/CD int\u00e9gr\u00e9.",
    },
    {
      icon: Globe,
      title: "Vercel",
      desc: "D\u00e9ploy\u00e9 sur TON Vercel. Ton domaine, ton CDN, tes analytics.",
    },
    {
      icon: Database,
      title: "Supabase",
      desc: "Ta BDD Postgres. RLS, auth, realtime \u2014 chez toi.",
    },
    {
      icon: Shield,
      title: "S\u00e9curit\u00e9",
      desc: "API keys chiffr\u00e9es AES-256-GCM. Jamais envoy\u00e9es au LLM.",
    },
    {
      icon: Eye,
      title: "Preview live",
      desc: "WebContainers in-browser. HMR sub-seconde. Z\u00e9ro latence.",
    },
    {
      icon: Zap,
      title: "Multi-mod\u00e8le",
      desc: "Claude, GPT-4o, Gemini. Le bon mod\u00e8le pour chaque t\u00e2che.",
    },
  ];

  return (
    <section className="relative border-t border-white/5 py-32">
      <div className="mx-auto max-w-6xl px-6">
        <FadeUp>
          <p className="mb-4 text-center text-sm font-medium uppercase tracking-widest text-orange-400">
            Stack
          </p>
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-5xl">
            Ton infra. Nos{" "}
            <span className="fyren-text-gradient">super-pouvoirs</span>.
          </h2>
        </FadeUp>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <ScaleIn key={feature.title} delay={i * 0.08}>
              <div className="group rounded-2xl border border-white/5 bg-white/[0.02] p-8 transition-all duration-300 hover:border-orange-500/20 hover:bg-orange-500/[0.03]">
                <div className="mb-4 inline-flex rounded-xl bg-orange-500/10 p-3">
                  <feature.icon className="h-6 w-6 text-orange-400" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {feature.desc}
                </p>
              </div>
            </ScaleIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   PRICING SECTION
   ────────────────────────────────────────────── */

function PricingSection() {
  const tiers = [
    {
      action: "Conversation d\u2019intake",
      time: "~15 min",
      cost: "$1\u20133",
    },
    { action: "Build app simple", time: "~30 min", cost: "$5\u201315" },
    { action: "Build SaaS complet", time: "~1\u20132h", cost: "$20\u201350" },
    {
      action: "It\u00e9ration (ajout feature)",
      time: "~15 min",
      cost: "$2\u201310",
    },
  ];

  return (
    <section className="relative border-t border-white/5 py-32">
      <div className="mx-auto max-w-4xl px-6">
        <FadeUp>
          <p className="mb-4 text-center text-sm font-medium uppercase tracking-widest text-orange-400">
            Pricing
          </p>
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-5xl">
            Pay-per-use.{" "}
            <span className="text-muted-foreground">
              Z&eacute;ro abonnement.
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-center text-muted-foreground">
            Tu paies quand tu utilises. Pas quand tu ne fais rien. Cr&eacute;dits sans
            expiration. $2 offerts &agrave; l&apos;inscription.
          </p>
        </FadeUp>

        <FadeUp delay={0.2}>
          <div className="mt-16 overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02]">
            <div className="grid grid-cols-3 border-b border-white/5 px-6 py-4 text-sm font-medium text-muted-foreground">
              <span>Action</span>
              <span className="text-center">Dur&eacute;e</span>
              <span className="text-right">Co&ucirc;t</span>
            </div>
            {tiers.map((tier, i) => (
              <motion.div
                key={tier.action}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="grid grid-cols-3 border-b border-white/5 px-6 py-5 last:border-0"
              >
                <span className="font-medium">{tier.action}</span>
                <span className="text-center text-muted-foreground">
                  {tier.time}
                </span>
                <span className="text-right font-semibold text-orange-400">
                  {tier.cost}
                </span>
              </motion.div>
            ))}
          </div>
        </FadeUp>

        <FadeUp delay={0.3}>
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Co&ucirc;t r&eacute;el OpenRouter &times; 3. Transparence totale.
            </p>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   FINAL CTA
   ────────────────────────────────────────────── */

function CtaSection() {
  return (
    <section className="relative overflow-hidden border-t border-white/5 py-32">
      {/* Background glow */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[400px] w-[400px] rounded-full bg-orange-500/10 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        <FadeUp>
          <h2 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Pr&ecirc;t &agrave;{" "}
            <span className="fyren-text-gradient">construire</span> ?
          </h2>
          <p className="mx-auto mt-6 max-w-lg text-lg text-muted-foreground">
            D&eacute;cris ton projet. Regarde-le se construire. D&eacute;ploie
            sur ton infra. En moins de 3 heures.
          </p>
        </FadeUp>

        <FadeUp delay={0.2}>
          <div className="mt-10">
            <Link
              href="/sign-up"
              className="fyren-glow group inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-10 py-5 text-lg font-semibold text-white transition-all hover:from-orange-400 hover:to-orange-500 hover:shadow-lg hover:shadow-orange-500/25"
            >
              Start building
              <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            $2 de cr&eacute;dits offerts. Pas de carte bancaire.
          </p>
        </FadeUp>
      </div>
    </section>
  );
}

/* ──────────────────────────────────────────────
   NAVBAR
   ────────────────────────────────────────────── */

function Navbar() {
  return (
    <motion.nav
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed left-0 right-0 top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-orange-600">
            <span className="text-sm font-bold text-white">F</span>
          </div>
          <span className="text-lg font-bold tracking-tight">FYREN</span>
        </Link>

        <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
          <Link
            href="#how-it-works"
            className="transition-colors hover:text-foreground"
          >
            Comment &ccedil;a marche
          </Link>
          <Link
            href="#pricing"
            className="transition-colors hover:text-foreground"
          >
            Pricing
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:from-orange-400 hover:to-orange-500"
          >
            Start building
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}

/* ──────────────────────────────────────────────
   FOOTER
   ────────────────────────────────────────────── */

function Footer() {
  return (
    <footer className="border-t border-white/5 py-12">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded bg-gradient-to-br from-orange-500 to-orange-600">
            <span className="text-[10px] font-bold text-white">F</span>
          </div>
          <span className="text-sm font-semibold">FYREN</span>
          <span className="text-sm text-muted-foreground">
            &mdash; Build it. Own it.
          </span>
        </div>
        <div className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} FYREN. Pay-per-use.
        </div>
      </div>
    </footer>
  );
}

/* ──────────────────────────────────────────────
   MAIN LANDING PAGE
   ────────────────────────────────────────────── */

export function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <ProblemSection />
        <SolutionSection />
        <DemoSection />
        <FeaturesSection />
        <div id="pricing">
          <PricingSection />
        </div>
        <CtaSection />
      </main>
      <Footer />
    </>
  );
}
