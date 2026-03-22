import { SignIn } from "@clerk/nextjs";
import Link from "next/link";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      {/* Background glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 -translate-y-1/2">
        <div className="h-[400px] w-[400px] rounded-full bg-orange-500/5 blur-[100px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center">
        {/* Logo */}
        <Link href="/" className="mb-8 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600">
            <span className="text-lg font-bold text-white">F</span>
          </div>
          <span className="text-2xl font-bold tracking-tight">FYREN</span>
        </Link>

        <SignIn
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-card border border-white/5 shadow-2xl shadow-black/50",
            },
          }}
        />
      </div>
    </div>
  );
}
