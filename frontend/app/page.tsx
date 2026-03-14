import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import Link from "next/link";

const DEPARTMENTS = [
  { name: "Identity",     desc: "Brand strategy, visual language, positioning, and the complete story of who you are.", tag: "10 specialists", icon: "◈" },
  { name: "Presence",     desc: "30-day social content strategy, voice systems, and platform-specific calendars.",      tag: "10 specialists", icon: "◉" },
  { name: "Growth",       desc: "Paid advertising across Meta and Google. Built to convert, not just impress.",          tag: "8 specialists",  icon: "◆" },
  { name: "Intelligence", desc: "Deep competitive research with source verification and strategic synthesis.",           tag: "5-layer analysis",icon: "◎" },
  { name: "Proposal",     desc: "Scoped business proposals with pricing, structured and ready to send.",                tag: "4 specialists",  icon: "◇" },
];

export default async function RootPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    if (session.user.role === "admin")  redirect("/dashboard");
    if (session.user.role === "client") redirect("/portal");
    if (session.user.role === "user")   redirect("/app");
  }

  return (
    <main style={{ background: "#0e0c09", color: "#f0e8d5", minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>

      {/* NAV */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "1.25rem 2.5rem",
        borderBottom: "1px solid #2e2619",
        backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(14,12,9,0.85)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "linear-gradient(135deg, #d4a043, #a07830)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 20px rgba(212,160,67,0.3)",
          }}>
            <span style={{ color: "#0e0c09", fontSize: 11, fontWeight: 800, letterSpacing: "0.05em" }}>AP</span>
          </div>
          <span style={{ fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(240,232,213,0.7)", fontWeight: 500 }}>
            Art Protocol
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <Link href="/login" className="ap-nav-link">
            Sign in
          </Link>
          <Link href="/signup" style={{
            fontSize: 13, padding: "0.5rem 1.25rem", borderRadius: 3,
            background: "#d4a043", color: "#0e0c09", fontWeight: 700,
            textDecoration: "none", letterSpacing: "0.03em",
            boxShadow: "0 0 16px rgba(212,160,67,0.25)",
            transition: "background 0.15s, box-shadow 0.15s",
          }}>
            Get started
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ position: "relative", overflow: "hidden" }}>

        {/* Background radial glow */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 80% 60% at 65% -10%, rgba(212,160,67,0.1) 0%, transparent 60%), radial-gradient(ellipse 40% 40% at 20% 80%, rgba(160,120,48,0.06) 0%, transparent 50%)",
        }} />

        {/* Abstract grid graphic */}
        <div style={{ position: "absolute", right: -40, top: 20, width: 520, height: 520, opacity: 0.18, pointerEvents: "none" }}>
          <svg viewBox="0 0 520 520" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="fade" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#d4a043" stopOpacity="1"/>
                <stop offset="100%" stopColor="#d4a043" stopOpacity="0"/>
              </radialGradient>
            </defs>
            {/* Grid lines */}
            {Array.from({length: 14}).map((_, i) => (
              <line key={`h${i}`} x1="0" y1={i*40} x2="520" y2={i*40} stroke="url(#fade)" strokeWidth="0.5"/>
            ))}
            {Array.from({length: 14}).map((_, i) => (
              <line key={`v${i}`} x1={i*40} y1="0" x2={i*40} y2="520" stroke="url(#fade)" strokeWidth="0.5"/>
            ))}
            {/* Scattered accent dots */}
            {[[80,80],[160,40],[240,120],[80,200],[320,80],[200,200],[360,160],[120,320],[280,280],[400,240],[160,400],[320,360],[440,320],[240,440]].map(([x,y], i) => (
              <circle key={i} cx={x} cy={y} r="2.5" fill="#d4a043" opacity="0.8"/>
            ))}
            {/* Connecting lines */}
            <path d="M80 80 L160 40 L240 120 L200 200 L120 320 L240 440" stroke="#d4a043" strokeWidth="0.8" opacity="0.4" fill="none"/>
            <path d="M320 80 L400 240 L320 360 L440 320" stroke="#d4a043" strokeWidth="0.8" opacity="0.3" fill="none"/>
            {/* Concentric arc */}
            <path d="M 260 520 A 280 280 0 0 1 520 260" stroke="#d4a043" strokeWidth="0.6" opacity="0.25" fill="none"/>
            <path d="M 260 520 A 200 200 0 0 1 460 260" stroke="#d4a043" strokeWidth="0.6" opacity="0.2" fill="none"/>
          </svg>
        </div>

        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "7rem 2.5rem 6rem" }}>
          <p style={{ fontSize: 11, letterSpacing: "0.4em", textTransform: "uppercase", color: "#d4a043", marginBottom: "1.75rem", fontWeight: 500 }}>
            Your complete agency. One account.
          </p>
          <h1 style={{ fontSize: "clamp(3rem, 8vw, 5.5rem)", fontWeight: 300, lineHeight: 1.05, letterSpacing: "-0.02em", marginBottom: "1.75rem", maxWidth: 700 }}>
            <span style={{ fontFamily: "Playfair Display, serif", fontStyle: "italic", color: "#f0e8d5" }}>Crafted</span>
            <span style={{ color: "#f0e8d5" }}> like art.</span>
            <br/>
            <span style={{ color: "#554d3a" }}>Delivered like</span>
            <br/>
            <span style={{ fontFamily: "Playfair Display, serif", fontStyle: "italic", color: "#d4a043" }}>protocol.</span>
          </h1>
          <p style={{ color: "#9a8864", fontSize: 16, maxWidth: 520, lineHeight: 1.75, marginBottom: "2.5rem" }}>
            Build your brand, grow your company, deploy campaigns — at a fraction of what traditional agencies charge.
            Every output is indistinguishable from senior agency work.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "1.5rem", flexWrap: "wrap" }}>
            <Link href="/signup" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "0.9rem 2rem", borderRadius: 3,
              background: "#d4a043", color: "#0e0c09",
              fontWeight: 700, fontSize: 13, letterSpacing: "0.04em",
              textDecoration: "none",
              boxShadow: "0 0 32px rgba(212,160,67,0.3), 0 4px 16px rgba(0,0,0,0.4)",
              textTransform: "uppercase",
            }}>
              Start building free
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path fillRule="evenodd" d="M1 8a.5.5 0 01.5-.5h11.793l-3.147-3.146a.5.5 0 01.708-.708l4 4a.5.5 0 010 .708l-4 4a.5.5 0 01-.708-.708L13.293 8.5H1.5A.5.5 0 011 8z"/>
              </svg>
            </Link>
            <span style={{ fontSize: 12, color: "#554d3a" }}>100 free credits · No card required</span>
          </div>
        </div>
      </section>

      {/* STATS BAR */}
      <div style={{ borderTop: "1px solid #2e2619", borderBottom: "1px solid #2e2619", background: "#161209" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "1.5rem 2.5rem", display: "flex", gap: "3rem", flexWrap: "wrap" }}>
          {[["5", "Departments"], ["37+", "Specialists"], ["100", "Free credits"], ["10×", "Faster than agencies"]].map(([num, label]) => (
            <div key={label}>
              <div style={{ fontSize: 22, fontFamily: "Playfair Display, serif", fontWeight: 600, color: "#d4a043", lineHeight: 1.1 }}>{num}</div>
              <div style={{ fontSize: 11, color: "#554d3a", letterSpacing: "0.1em", marginTop: 2, textTransform: "uppercase" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* PHILOSOPHY */}
      <section style={{ borderBottom: "1px solid #2e2619", padding: "4rem 2.5rem" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3rem" }}>
          <div style={{ padding: "2rem", borderRadius: 4, background: "linear-gradient(135deg, rgba(212,160,67,0.06) 0%, transparent 60%)", border: "1px solid rgba(212,160,67,0.15)" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.3em", color: "#d4a043", textTransform: "uppercase", marginBottom: "1rem", fontWeight: 600 }}>Art</div>
            <div style={{ fontFamily: "Playfair Display, serif", fontSize: 28, fontWeight: 400, color: "#f0e8d5", fontStyle: "italic", marginBottom: "1rem", lineHeight: 1.3 }}>
              The creative dimension
            </div>
            <p style={{ color: "#9a8864", fontSize: 14, lineHeight: 1.75 }}>
              Cultural insight, psychological depth, genuine originality — the kind of creative thinking that moves people.
            </p>
          </div>
          <div style={{ padding: "2rem", borderRadius: 4, background: "rgba(255,255,255,0.02)", border: "1px solid #2e2619" }}>
            <div style={{ fontSize: 10, letterSpacing: "0.3em", color: "#554d3a", textTransform: "uppercase", marginBottom: "1rem", fontWeight: 600 }}>Protocol</div>
            <div style={{ fontFamily: "Playfair Display, serif", fontSize: 28, fontWeight: 400, color: "#9a8864", marginBottom: "1rem", lineHeight: 1.3 }}>
              The systematic dimension
            </div>
            <p style={{ color: "#554d3a", fontSize: 14, lineHeight: 1.75 }}>
              Structured frameworks, rigorous process, consistent execution — the machine that never misses a deadline.
            </p>
          </div>
        </div>
      </section>

      {/* DEPARTMENTS */}
      <section style={{ padding: "5rem 2.5rem", maxWidth: 1000, margin: "0 auto" }}>
        <p style={{ fontSize: 10, letterSpacing: "0.4em", color: "#554d3a", textTransform: "uppercase", marginBottom: "2.5rem", fontWeight: 500 }}>
          Departments
        </p>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {DEPARTMENTS.map((dept, i) => (
            <div key={dept.name} style={{
              display: "flex", alignItems: "flex-start", justifyContent: "space-between",
              padding: "1.75rem 0",
              borderBottom: "1px solid #2e2619",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "2rem" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, paddingTop: 4 }}>
                  <span style={{ color: "#d4a043", fontSize: 16 }}>{dept.icon}</span>
                  <span style={{ color: "#2e2619", fontSize: 10, fontFamily: "JetBrains Mono, monospace" }}>{String(i+1).padStart(2,"0")}</span>
                </div>
                <div>
                  <h3 style={{ color: "#f0e8d5", fontWeight: 500, fontSize: 15, marginBottom: "0.4rem", letterSpacing: "0.01em" }}>
                    {dept.name}
                  </h3>
                  <p style={{ color: "#554d3a", fontSize: 13, lineHeight: 1.65, maxWidth: 420 }}>
                    {dept.desc}
                  </p>
                </div>
              </div>
              <span style={{ fontSize: 10, color: "#3a3020", fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.1em", marginTop: 4, flexShrink: 0, marginLeft: "1rem" }}>
                {dept.tag}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* QUOTE */}
      <section style={{ borderTop: "1px solid #2e2619", padding: "5rem 2.5rem", background: "#161209" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", position: "relative" }}>
          <div style={{
            position: "absolute", top: -20, left: -10,
            fontSize: 100, fontFamily: "Playfair Display, serif",
            color: "rgba(212,160,67,0.08)", lineHeight: 1, fontWeight: 600,
          }}>"</div>
          <blockquote style={{
            fontFamily: "Playfair Display, serif",
            fontSize: "clamp(1.2rem, 2.5vw, 1.75rem)",
            fontWeight: 400, color: "#9a8864",
            lineHeight: 1.65, maxWidth: 700,
            paddingLeft: "1.5rem",
            borderLeft: "2px solid rgba(212,160,67,0.3)",
          }}>
            What took us three months and{" "}
            <em style={{ color: "#f0e8d5" }}>₹40 lakhs</em> at our last agency —
            Art Protocol delivered in an afternoon.
          </blockquote>
          <p style={{ color: "#3a3020", fontSize: 12, marginTop: "1.5rem", paddingLeft: "1.5rem", letterSpacing: "0.1em" }}>
            — Early access user
          </p>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "6rem 2.5rem", textAlign: "center", position: "relative", overflow: "hidden" }}>
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 60% 50% at 50% 50%, rgba(212,160,67,0.07) 0%, transparent 65%)",
        }}/>
        <h2 style={{
          fontFamily: "Playfair Display, serif",
          fontSize: "clamp(2rem, 5vw, 3.5rem)",
          fontWeight: 400, color: "#f0e8d5",
          lineHeight: 1.2, marginBottom: "1rem",
        }}>
          Your dreams deserve<br/>
          <span style={{ fontStyle: "italic", color: "#d4a043" }}>impeccable execution.</span>
        </h2>
        <p style={{ color: "#554d3a", marginBottom: "2.5rem", fontSize: 13 }}>
          Start with 100 free credits. No credit card required.
        </p>
        <Link href="/signup" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "1rem 2.5rem", borderRadius: 3,
          background: "#d4a043", color: "#0e0c09",
          fontWeight: 700, fontSize: 13, letterSpacing: "0.05em",
          textDecoration: "none", textTransform: "uppercase",
          boxShadow: "0 0 40px rgba(212,160,67,0.25), 0 8px 32px rgba(0,0,0,0.5)",
        }}>
          Create your account
        </Link>
      </section>

      {/* FOOTER */}
      <footer style={{
        borderTop: "1px solid #2e2619",
        padding: "1.5rem 2.5rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "#0e0c09",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div style={{
            width: 22, height: 22, borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(212,160,67,0.3), rgba(212,160,67,0.1))",
            border: "1px solid rgba(212,160,67,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ color: "#d4a043", fontSize: 8, fontWeight: 800 }}>AP</span>
          </div>
          <span style={{ color: "#3a3020", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase" }}>Art Protocol</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          <Link href="/login" style={{ color: "#3a3020", fontSize: 11, textDecoration: "none", letterSpacing: "0.1em" }}>
            Admin sign in
          </Link>
          <span style={{ color: "#2e2619", fontSize: 11 }}>© 2026</span>
        </div>
      </footer>

    </main>
  );
}
