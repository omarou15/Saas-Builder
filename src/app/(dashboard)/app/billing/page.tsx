"use client";

import { useEffect, useState } from "react";
import { CreditCard, Coins, History, Loader2 } from "lucide-react";

interface Transaction {
  id: string;
  type: string;
  amount: number;
  description: string;
  created_at: string;
}

export default function BillingPage() {
  const [credits, setCredits] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBilling() {
      try {
        const [creditsRes, usageRes] = await Promise.all([
          fetch("/api/billing/credits"),
          fetch("/api/billing/usage"),
        ]);

        if (creditsRes.ok) {
          const data = (await creditsRes.json()) as { credits: number };
          setCredits(data.credits ?? 0);
        }

        if (usageRes.ok) {
          const data = (await usageRes.json()) as { transactions: Transaction[] };
          setTransactions(data.transactions ?? []);
        }
      } catch {
        // Silently fail — credits will show as 0
      } finally {
        setLoading(false);
      }
    }
    void fetchBilling();
  }, []);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gère tes crédits et consulte ton historique.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Credit balance */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
                <Coins className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Solde actuel</p>
                <p className="text-2xl font-bold">
                  ${credits !== null ? credits.toFixed(2) : "0.00"}
                </p>
              </div>
            </div>
            <button
              disabled
              className="inline-flex items-center gap-2 rounded-lg bg-white/5 px-4 py-2.5 text-sm font-medium text-muted-foreground cursor-not-allowed"
            >
              <CreditCard className="h-4 w-4" />
              Acheter des crédits (bientôt disponible)
            </button>
          </div>

          {/* Transaction history */}
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-6">
            <div className="flex items-center gap-3 mb-4">
              <History className="h-5 w-5 text-muted-foreground" />
              <h2 className="font-semibold">Historique</h2>
            </div>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Aucune transaction pour le moment.
              </p>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between rounded-lg border border-white/5 px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span
                      className={`text-sm font-semibold ${
                        tx.amount > 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {tx.amount > 0 ? "+" : ""}
                      ${tx.amount.toFixed(4)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
