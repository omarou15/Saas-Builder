"use client";

import { useRef } from "react";
import { motion, useInView } from "framer-motion";

export function PreviewMockup({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      className={`overflow-hidden rounded-xl border border-white/5 bg-[#0d0d0f] ${className ?? ""}`}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, delay: 0.3 }}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
        <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
        <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
        <div className="ml-4 flex-1 rounded-md bg-white/5 px-3 py-1 text-xs text-muted-foreground">
          karim-saas.vercel.app
        </div>
      </div>

      {/* App preview content */}
      <div className="p-6">
        <div className="space-y-4">
          {/* Nav mockup */}
          <div className="flex items-center justify-between">
            <div className="h-6 w-24 rounded bg-white/10" />
            <div className="flex gap-3">
              <div className="h-6 w-16 rounded bg-white/5" />
              <div className="h-6 w-16 rounded bg-white/5" />
              <div className="h-8 w-20 rounded-md bg-orange-500/80" />
            </div>
          </div>

          {/* Hero mockup */}
          <div className="mt-8 space-y-3">
            <motion.div
              className="h-8 w-3/4 rounded bg-white/10"
              initial={{ width: 0 }}
              animate={isInView ? { width: "75%" } : {}}
              transition={{ duration: 1, delay: 0.8 }}
            />
            <motion.div
              className="h-4 w-1/2 rounded bg-white/5"
              initial={{ width: 0 }}
              animate={isInView ? { width: "50%" } : {}}
              transition={{ duration: 1, delay: 1 }}
            />
          </div>

          {/* Cards mockup */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="space-y-2 rounded-lg border border-white/5 bg-white/[0.02] p-4"
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 1.2 + i * 0.15 }}
              >
                <div className="h-3 w-full rounded bg-white/10" />
                <div className="h-3 w-2/3 rounded bg-white/5" />
                <div className="mt-3 h-16 w-full rounded bg-white/[0.03]" />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
