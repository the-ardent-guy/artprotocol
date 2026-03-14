"use client";

import Link from "next/link";

interface FreemiumGateProps {
  children:      React.ReactNode;
  locked:        boolean;
  creditsNeeded?: number;
}

export default function FreemiumGate({ children, locked, creditsNeeded }: FreemiumGateProps) {
  if (!locked) return <>{children}</>;

  return (
    <div style={{ position: "relative" }}>
      {/* Blurred preview */}
      <div style={{ filter: "blur(5px)", opacity: 0.3, pointerEvents: "none", userSelect: "none" }}>
        {children}
      </div>

      {/* Overlay */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        background: "linear-gradient(to bottom, rgba(14,12,9,0) 0%, rgba(14,12,9,0.7) 30%, rgba(14,12,9,0.95) 60%)",
        borderRadius: 4,
      }}>
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: 320 }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(212,160,67,0.15), rgba(212,160,67,0.05))",
            border: "1px solid rgba(212,160,67,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1.25rem",
            fontSize: 20,
          }}>
            ◈
          </div>
          <p style={{ fontFamily: "Playfair Display, serif", fontSize: 20, fontWeight: 400, color: "#f0e8d5", marginBottom: "0.5rem", fontStyle: "italic" }}>
            Preview mode
          </p>
          <p style={{ fontSize: 12, color: "#554d3a", marginBottom: "1.5rem", lineHeight: 1.7 }}>
            You're seeing 20% of this deliverable.
            {creditsNeeded
              ? ` Add ${creditsNeeded} credits to unlock.`
              : " Add credits to unlock the full output."}
          </p>
          <Link href="/app/credits" style={{
            display: "inline-block",
            padding: "0.65rem 1.5rem",
            background: "#d4a043", color: "#0e0c09",
            fontSize: 12, fontWeight: 700, letterSpacing: "0.05em",
            textTransform: "uppercase",
            borderRadius: 3, textDecoration: "none",
            boxShadow: "0 0 24px rgba(212,160,67,0.3)",
          }}>
            Add credits
          </Link>
        </div>
      </div>
    </div>
  );
}
