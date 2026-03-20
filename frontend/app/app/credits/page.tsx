"use client";

import { useState, useEffect } from "react";
import { apiFetch, APUser } from "@/lib/userAuth";
import Link from "next/link";

interface Transaction {
  id:          number;
  type:        "credit" | "debit";
  amount:      number;
  description: string;
  created_at:  string;
}

const PACKAGES = [
  { id: "starter", name: "Starter",  credits: 500,  price: 499,  tag: null,           color: "#1e1a12" },
  { id: "growth",  name: "Growth",   credits: 1600, price: 1499, tag: "Most popular",  color: "linear-gradient(135deg, #1e1a12 0%, #261e0e 100%)" },
  { id: "agency",  name: "Agency",   credits: 4500, price: 3999, tag: "Best value",    color: "#1e1a12" },
];

const DEPT_COSTS = [
  { name: "Intelligence", icon: "◎", cost: 120 },
  { name: "Proposal",     icon: "◇", cost: 180 },
  { name: "Identity",     icon: "◈", cost: 350 },
  { name: "Presence",     icon: "◉", cost: 350 },
  { name: "Growth",       icon: "◆", cost: 400 },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function CreditsPage() {
  const [user,         setUser]         = useState<APUser | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [buyLoading,   setBuyLoading]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [u, txData] = await Promise.all([
          apiFetch<APUser>("/me"),
          apiFetch<{ history: Transaction[] }>("/me/credits"),
        ]);
        setUser(u);
        setTransactions(txData.history || []);
      } catch (e: any) { setError(e.message); }
      setLoading(false);
    })();
  }, []);

  async function handleBuy(pkg: typeof PACKAGES[0]) {
    setBuyLoading(pkg.id);
    setError("");
    try {
      const order = await apiFetch<{ order_id: string; amount: number; currency: string; key: string }>(
        "/payments/razorpay/order",
        { method: "POST", body: JSON.stringify({ package_id: pkg.id }) }
      );
      const win = window as any;
      if (!win.Razorpay) { setError("Payment gateway not loaded. Refresh and try again."); return; }
      new win.Razorpay({
        key: order.key, amount: order.amount, currency: order.currency,
        name: "Art Protocol", description: `${pkg.name} — ${pkg.credits} credits`,
        order_id: order.order_id, theme: { color: "#d4a043" },
        handler: async (res: any) => {
          try {
            await apiFetch("/payments/razorpay/verify", {
              method: "POST",
              body: JSON.stringify({
                razorpay_order_id:   res.razorpay_order_id,
                razorpay_payment_id: res.razorpay_payment_id,
                razorpay_signature:  res.razorpay_signature,
              }),
            });
            const [u2, tx2] = await Promise.all([
              apiFetch<APUser>("/me"),
              apiFetch<{ history: Transaction[] }>("/me/credits"),
            ]);
            setUser(u2); setTransactions(tx2.history || []);
          } catch (e: any) { setError(e.message); }
        },
      }).open();
    } catch (e: any) { setError(e.message); }
    setBuyLoading(null);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 20, height: 20, border: "2px solid #d4a043", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.7s linear infinite" }}/>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const balance = user ? Math.floor(user.credits) : 0;
  const pct     = Math.min(100, (balance / 500) * 100);

  return (
    <div style={{ padding: "2.5rem", maxWidth: 960, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: "3rem" }}>
        <p style={{ fontSize: 10, letterSpacing: "0.3em", color: "#d4a043", textTransform: "uppercase", marginBottom: "0.5rem" }}>Credits</p>
        <div style={{ display: "flex", alignItems: "flex-end", gap: "1.5rem", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 40, fontFamily: "Playfair Display, serif", fontWeight: 400, color: "#f0e8d5", lineHeight: 1 }}>
            {balance.toLocaleString()}
          </h1>
          <span style={{ fontSize: 14, color: "#554d3a", paddingBottom: "0.25rem" }}>credits remaining</span>
        </div>

        {/* Balance bar */}
        <div style={{ marginTop: "1rem", maxWidth: 320 }}>
          <div style={{ height: 3, background: "#2e2619", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${pct}%`,
              background: balance < 150
                ? "#d4a043"
                : "linear-gradient(90deg, #a07830, #d4a043)",
              borderRadius: 2,
              boxShadow: "0 0 8px rgba(212,160,67,0.4)",
              transition: "width 0.5s ease",
            }}/>
          </div>
          {balance < 150 && (
            <p style={{ fontSize: 11, color: "#d4a043", marginTop: "0.4rem" }}>Low balance — top up to keep deploying</p>
          )}
        </div>
      </div>

      {error && (
        <p style={{ color: "#e08080", fontSize: 12, marginBottom: "1.5rem", background: "rgba(224,96,96,0.08)", padding: "0.6rem 1rem", borderRadius: 3, border: "1px solid rgba(224,96,96,0.15)" }}>
          {error}
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "3rem" }}>
        {/* Left */}
        <div>
          {/* Packages */}
          <p style={{ fontSize: 10, letterSpacing: "0.2em", color: "#554d3a", textTransform: "uppercase", marginBottom: "1rem", fontWeight: 500 }}>
            Add credits
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "2.5rem" }}>
            {PACKAGES.map((pkg) => (
              <div key={pkg.id} style={{
                background: pkg.color,
                border: `1px solid ${pkg.tag ? "rgba(212,160,67,0.3)" : "#2e2619"}`,
                borderRadius: 5,
                padding: "1.5rem",
                display: "flex", flexDirection: "column",
                position: "relative",
                boxShadow: pkg.tag ? "0 0 24px rgba(212,160,67,0.08)" : "none",
              }}>
                {pkg.tag && (
                  <span style={{
                    position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)",
                    background: "#d4a043", color: "#0e0c09",
                    fontSize: 9, fontWeight: 700, padding: "0.2rem 0.6rem",
                    borderRadius: 20, whiteSpace: "nowrap", letterSpacing: "0.05em",
                  }}>
                    {pkg.tag}
                  </span>
                )}
                <p style={{ fontSize: 10, color: "#554d3a", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "1rem" }}>{pkg.name}</p>
                <p style={{ fontSize: 28, fontFamily: "Playfair Display, serif", fontWeight: 600, color: "#f0e8d5", lineHeight: 1, marginBottom: "0.2rem" }}>
                  {pkg.credits.toLocaleString()}
                </p>
                <p style={{ fontSize: 10, color: "#3a3020", marginBottom: "1.25rem" }}>credits</p>
                <p style={{ fontSize: 22, color: "#f0e8d5", fontWeight: 300, marginBottom: "1.25rem", flex: 1 }}>
                  ₹{pkg.price.toLocaleString()}
                </p>
                <button
                  onClick={() => handleBuy(pkg)}
                  disabled={buyLoading === pkg.id}
                  style={{
                    padding: "0.65rem",
                    background: pkg.tag ? "#d4a043" : "#1e1a12",
                    border: pkg.tag ? "none" : "1px solid #2e2619",
                    borderRadius: 3, fontSize: 12,
                    color: pkg.tag ? "#0e0c09" : "#9a8864",
                    fontWeight: pkg.tag ? 700 : 400,
                    cursor: buyLoading === pkg.id ? "not-allowed" : "pointer",
                    letterSpacing: "0.03em",
                    transition: "background 0.15s",
                  }}
                >
                  {buyLoading === pkg.id ? "Opening..." : "Buy"}
                </button>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 10, color: "#2e2619", letterSpacing: "0.05em" }}>
            Payments via Razorpay · INR · Secure checkout
          </p>

          {/* Dept costs */}
          <div style={{ marginTop: "2.5rem" }}>
            <p style={{ fontSize: 10, letterSpacing: "0.2em", color: "#554d3a", textTransform: "uppercase", marginBottom: "1rem" }}>
              Department costs
            </p>
            <div style={{ border: "1px solid #2e2619", borderRadius: 4, overflow: "hidden" }}>
              {DEPT_COSTS.map((d, i) => (
                <div key={d.name} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "0.85rem 1.25rem",
                  borderBottom: i < DEPT_COSTS.length - 1 ? "1px solid #2e2619" : "none",
                  background: "#161209",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span style={{ color: "#d4a043", fontSize: 13 }}>{d.icon}</span>
                    <span style={{ fontSize: 13, color: "#9a8864" }}>{d.name}</span>
                  </div>
                  <span style={{ fontSize: 12, color: "#554d3a", fontFamily: "JetBrains Mono, monospace" }}>{d.cost} Credits</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right — history */}
        <div>
          <p style={{ fontSize: 10, letterSpacing: "0.2em", color: "#554d3a", textTransform: "uppercase", marginBottom: "1rem" }}>
            History
          </p>
          {transactions.length === 0 ? (
            <p style={{ fontSize: 12, color: "#3a3020" }}>No transactions yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {transactions.map((t) => (
                <div key={t.id} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "0.75rem 1rem", background: "#161209", border: "1px solid #2e2619", borderRadius: 3 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ fontSize: 12, color: "#9a8864", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }}>{t.description}</p>
                    <p style={{ fontSize: 10, color: "#3a3020", marginTop: 2 }}>{formatDate(t.created_at)}</p>
                  </div>
                  <span style={{
                    fontSize: 12, fontFamily: "JetBrains Mono, monospace",
                    color: t.type === "credit" ? "#6aaa6a" : "#554d3a",
                    marginLeft: "0.75rem", flexShrink: 0,
                  }}>
                    {t.type === "credit" ? "+" : "−"}{Math.abs(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
