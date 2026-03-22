"use client";

import { UserProfile } from "@clerk/nextjs";
import { Settings as SettingsIcon, Shield, Bell } from "lucide-react";

export default function SettingsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gère ton compte et tes préférences.
        </p>
      </div>

      <div className="space-y-6">
        {/* Clerk profile */}
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
              <SettingsIcon className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <h2 className="font-semibold">Profil</h2>
              <p className="text-sm text-muted-foreground">
                Email, mot de passe et sécurité.
              </p>
            </div>
          </div>
          <UserProfile
            appearance={{
              elements: {
                rootBox: "w-full",
                cardBox: "shadow-none w-full border-0",
                card: "bg-transparent shadow-none border-0",
                navbar: "hidden",
                pageScrollBox: "p-0",
                page: "p-0",
              },
            }}
          />
        </div>

        {/* Placeholder sections */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
            <div className="flex items-center gap-3 mb-2">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Connexions</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              GitHub, Vercel, Supabase — gérés par projet dans le workspace.
            </p>
          </div>

          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
            <div className="flex items-center gap-3 mb-2">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <h3 className="font-semibold">Notifications</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Bientôt disponible.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
