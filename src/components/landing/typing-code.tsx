"use client";

import { useEffect, useState } from "react";
import { useInView } from "framer-motion";
import { useRef } from "react";

const CODE_LINES = [
  { text: "// FYREN is building your app...", color: "text-muted-foreground" },
  { text: 'import { auth } from "@clerk/nextjs"', color: "text-orange-400" },
  { text: 'import { supabase } from "@/lib/db"', color: "text-orange-400" },
  { text: "", color: "" },
  { text: "export async function getProjects() {", color: "text-blue-400" },
  { text: "  const { userId } = await auth()", color: "text-foreground" },
  { text: "  const { data } = await supabase", color: "text-foreground" },
  { text: '    .from("projects")', color: "text-green-400" },
  { text: '    .select("*")', color: "text-green-400" },
  { text: '    .eq("user_id", userId)', color: "text-green-400" },
  { text: "  return data", color: "text-foreground" },
  { text: "}", color: "text-blue-400" },
];

export function TypingCode({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [visibleLines, setVisibleLines] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const interval = setInterval(() => {
      setVisibleLines((prev) => {
        if (prev >= CODE_LINES.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 300);
    return () => clearInterval(interval);
  }, [isInView]);

  return (
    <div
      ref={ref}
      className={`overflow-hidden rounded-xl border border-white/5 bg-[#0d0d0f] p-5 font-mono text-sm ${className ?? ""}`}
    >
      <div className="mb-4 flex items-center gap-2">
        <div className="h-3 w-3 rounded-full bg-red-500/70" />
        <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
        <div className="h-3 w-3 rounded-full bg-green-500/70" />
        <span className="ml-3 text-xs text-muted-foreground">
          src/server/projects.ts
        </span>
      </div>
      <div className="space-y-1">
        {CODE_LINES.slice(0, visibleLines).map((line, i) => (
          <div
            key={i}
            className={`${line.color} transition-opacity duration-300`}
            style={{
              opacity: i < visibleLines ? 1 : 0,
            }}
          >
            {line.text || "\u00A0"}
          </div>
        ))}
        {visibleLines < CODE_LINES.length && visibleLines > 0 && (
          <span className="inline-block h-4 w-2 animate-pulse bg-orange-500" />
        )}
      </div>
    </div>
  );
}
