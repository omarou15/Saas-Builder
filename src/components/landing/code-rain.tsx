"use client";

import { useEffect, useRef } from "react";

export function CodeRain({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();

    const chars =
      "const function return import export async await if else for while class extends implements interface type let var new this".split(
        ""
      );
    const fontSize = 13;
    const columns = Math.floor(canvas.offsetWidth / fontSize);
    const drops: number[] = Array.from({ length: columns }, () =>
      Math.random() * -100
    );

    let animationFrame: number;

    const draw = () => {
      ctx.fillStyle = "rgba(10, 10, 11, 0.06)";
      ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

      ctx.font = `${fontSize}px var(--font-mono), monospace`;

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const opacity = Math.random() * 0.15 + 0.03;
        ctx.fillStyle = `rgba(249, 115, 22, ${opacity})`;
        ctx.fillText(char ?? ".", i * fontSize, (drops[i] ?? 0) * fontSize);

        if (
          (drops[i] ?? 0) * fontSize > canvas.offsetHeight &&
          Math.random() > 0.985
        ) {
          drops[i] = 0;
        }
        drops[i] = (drops[i] ?? 0) + 0.3 + Math.random() * 0.5;
      }

      animationFrame = requestAnimationFrame(draw);
    };

    draw();

    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 ${className ?? ""}`}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
