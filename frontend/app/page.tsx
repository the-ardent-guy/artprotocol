import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function RootPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    if (session.user.role === "admin")  redirect("/dashboard");
    if (session.user.role === "client") redirect("/portal");
    if (session.user.role === "user")   redirect("/app");
  }

  return (
    <main style={{ background: "#FDFAF5", color: "#0D0A06", minHeight: "100vh", fontFamily: "Inter, sans-serif" }}>

      {/* ─── NAV ─────────────────────────────────────────────────────────────── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        background: "#ffffff",
        borderBottom: "1px solid #E8E0D0",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 clamp(1.25rem, 4vw, 2.5rem)",
        height: 60,
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <img src='/ap-logo.png' alt='Art Protocol' style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', display: 'block', flexShrink: 0 }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: "#0D0A06", letterSpacing: "-0.01em" }}>Art Protocol</span>
        </div>

        {/* Right nav */}
        <div style={{ display: "flex", alignItems: "center", gap: "clamp(0.75rem, 2vw, 1.5rem)" }}>
          <Link href="/login" style={{ fontSize: 14, color: "#6B6252", textDecoration: "none", fontWeight: 500 }}>
            Sign in
          </Link>
          <Link href="/signup" style={{
            fontSize: 13, fontWeight: 700, padding: "0.5rem 1.2rem",
            background: "#0D0A06", color: "#ffffff",
            borderRadius: 8, textDecoration: "none",
            letterSpacing: "0.01em", whiteSpace: "nowrap",
          }}>
            Get started free →
          </Link>
        </div>
      </nav>

      {/* ─── HERO ────────────────────────────────────────────────────────────── */}
      <section style={{
        maxWidth: 1200, margin: "0 auto",
        padding: "clamp(3rem, 8vw, 6rem) clamp(1.25rem, 4vw, 2.5rem) clamp(3rem, 6vw, 5rem)",
        display: "flex", flexWrap: "wrap", gap: "3rem", alignItems: "center",
      }}>

        {/* Left: text */}
        <div style={{ flex: "1 1 420px", minWidth: 0 }}>

          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "0.4rem",
            border: "1.5px solid #D4A043",
            borderRadius: 100, padding: "0.3rem 0.9rem",
            marginBottom: "1.75rem",
            background: "rgba(212,160,67,0.06)",
          }}>
            <span style={{ fontSize: 13 }}>⚡</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#a07010", letterSpacing: "0.01em" }}>
              Built by practitioners. Designed for founders.
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: "clamp(2.6rem, 6vw, 4.2rem)",
            fontWeight: 800,
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            color: "#0D0A06",
            marginBottom: "1.35rem",
            fontFamily: "Inter, system-ui, sans-serif",
          }}>
            Get your brand live.<br/>
            <span style={{ background: "linear-gradient(135deg, #6C63FF, #D4A043)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Faster than you think.
            </span>
          </h1>

          {/* Subheadline */}
          <p style={{
            fontSize: "clamp(15px, 2vw, 17px)", color: "#6B6252",
            lineHeight: 1.7, maxWidth: 520, marginBottom: "2.25rem",
          }}>
            Every agent is trained on the real practices of senior marketing specialists with decades of combined experience. Brief once. Deploy a team of AI specialists. Launch faster than any agency could.
          </p>

          {/* CTA row */}
          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap", marginBottom: "2rem" }}>
            <Link href="/signup" style={{
              display: "inline-block",
              padding: "0.8rem 1.7rem",
              background: "#0D0A06", color: "#ffffff",
              fontWeight: 700, fontSize: 14,
              borderRadius: 10, textDecoration: "none",
              letterSpacing: "0.01em",
              boxShadow: "0 4px 20px rgba(13,10,6,0.25)",
            }}>
              Run your first research free →
            </Link>
            <span style={{ fontSize: 13, color: "#B8AD9E" }}>100 credits included · No card required</span>
          </div>

          {/* Dept pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {[
              { name: "Research",              color: "#4F8EF0" },
              { name: "Identity",              color: "#E8A020" },
              { name: "Social Media",          color: "#9B5DE5" },
              { name: "Growth",                color: "#F15B50" },
              { name: "Decks",                 color: "#2DAA6E" },
              { name: "Shopify ⚡ Coming Soon", color: "#96BF48" },
            ].map(d => (
              <span key={d.name} style={{
                display: "inline-flex", alignItems: "center", gap: "0.35rem",
                fontSize: 12, fontWeight: 600,
                padding: "0.3rem 0.75rem",
                background: "#ffffff",
                border: "1.5px solid #E8E0D0",
                borderRadius: 100, color: "#0D0A06",
              }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: d.color, display: "inline-block", flexShrink: 0 }}/>
                {d.name}
              </span>
            ))}
          </div>
        </div>

        {/* Right: product mockup */}
        <div style={{ flex: "0 1 380px", minWidth: 280 }}>
          <div style={{
            background: "#1A1612",
            borderRadius: 20,
            padding: "1.5rem",
            boxShadow: "0 32px 80px rgba(13,10,6,0.22), 0 0 0 1px rgba(255,255,255,0.06)",
            fontFamily: "Inter, sans-serif",
          }}>
            {/* Mock header */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.1rem" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #D4A043, #a07830)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ color: "#fff", fontSize: 8, fontWeight: 800 }}>AP</span>
              </div>
              <span style={{ color: "#F0E8D5", fontSize: 12, fontWeight: 700 }}>Art Protocol Studio</span>
              <div style={{ marginLeft: "auto", display: "flex", gap: "0.3rem" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F15B50", opacity: 0.8 }}/>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#E8A020", opacity: 0.8 }}/>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2DAA6E", opacity: 0.8 }}/>
              </div>
            </div>

            {/* Mock brief box */}
            <div style={{
              background: "#241F18",
              borderRadius: 10,
              padding: "0.8rem 1rem",
              marginBottom: "1rem",
              border: "1px solid rgba(255,255,255,0.07)",
            }}>
              <p style={{ fontSize: 11, color: "#6B6252", marginBottom: "0.3rem", letterSpacing: "0.05em", textTransform: "uppercase" }}>Brand Brief</p>
              <p style={{ fontSize: 13, color: "#C8BFB2", lineHeight: 1.5 }}>CBD wellness brand targeting Gen Z through clean, science-backed storytelling...</p>
              <div style={{ marginTop: "0.65rem", display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, padding: "0.2rem 0.5rem", background: "rgba(79,142,240,0.15)", color: "#4F8EF0", borderRadius: 4, fontWeight: 600 }}>D2C</span>
                <span style={{ fontSize: 10, padding: "0.2rem 0.5rem", background: "rgba(155,93,229,0.15)", color: "#9B5DE5", borderRadius: 4, fontWeight: 600 }}>Gen Z</span>
                <span style={{ fontSize: 10, padding: "0.2rem 0.5rem", background: "rgba(45,170,110,0.15)", color: "#2DAA6E", borderRadius: 4, fontWeight: 600 }}>Wellness</span>
              </div>
            </div>

            {/* Mock dept cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {[
                { icon: "◎", name: "Research",    label: "Running analysis…", color: "#4F8EF0", status: "active" },
                { icon: "◈", name: "Identity",    label: "Ready", color: "#E8A020", status: "ready" },
                { icon: "◉", name: "Social Media", label: "Ready", color: "#9B5DE5", status: "ready" },
              ].map(d => (
                <div key={d.name} style={{
                  display: "flex", alignItems: "center", gap: "0.65rem",
                  background: d.status === "active" ? `rgba(${d.color === "#4F8EF0" ? "79,142,240" : ""},0.08)` : "#241F18",
                  borderRadius: 8, padding: "0.55rem 0.75rem",
                  border: `1px solid ${d.status === "active" ? d.color + "40" : "rgba(255,255,255,0.05)"}`,
                }}>
                  <span style={{ fontSize: 14, color: d.color }}>{d.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#C8BFB2", flex: 1 }}>{d.name}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 600,
                    color: d.status === "active" ? "#4F8EF0" : "#6B6252",
                    padding: "0.15rem 0.45rem",
                    background: d.status === "active" ? "rgba(79,142,240,0.12)" : "rgba(255,255,255,0.04)",
                    borderRadius: 4,
                  }}>
                    {d.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Mock progress bar */}
            <div style={{ marginTop: "0.9rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.35rem" }}>
                <span style={{ fontSize: 10, color: "#6B6252" }}>Generating report</span>
                <span style={{ fontSize: 10, color: "#4F8EF0", fontWeight: 700 }}>62%</span>
              </div>
              <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 100, overflow: "hidden" }}>
                <div style={{ width: "62%", height: "100%", background: "linear-gradient(90deg, #4F8EF0, #9B5DE5)", borderRadius: 100 }}/>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ────────────────────────────────────────────────────── */}
      <section style={{ background: "#F5F0E8", padding: "clamp(3rem, 6vw, 5rem) clamp(1.25rem, 4vw, 2.5rem)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "clamp(2rem, 4vw, 3.5rem)" }}>
            <h2 style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
              fontWeight: 800, color: "#0D0A06",
              letterSpacing: "-0.02em", lineHeight: 1.15,
            }}>
              A full team, ready in seconds.
            </h2>
            <p style={{ fontSize: 16, color: "#6B6252", maxWidth: 520, margin: "0.6rem auto 0" }}>
              No briefs. No meetings. No waiting. Just results.
            </p>
          </div>
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            {[
              {
                num: "①",
                title: "Brief your brand",
                desc: "Tell us what you're building, who it's for, and what makes it different. Plain English, no templates.",
              },
              {
                num: "②",
                title: "Deploy your specialists",
                desc: "Pick a department. Multiple AI agents — each trained on years of specialist expertise — go to work in parallel.",
              },
              {
                num: "③",
                title: "Launch with confidence",
                desc: "Receive structured, actionable deliverables. Market reports, brand books, ad campaigns, social calendars. Download as PDF and execute.",
              },
            ].map(step => (
              <div key={step.num} style={{
                flex: "1 1 260px",
                background: "#ffffff",
                borderRadius: 16,
                padding: "2rem 1.75rem",
                boxShadow: "0 4px 24px rgba(13,10,6,0.06)",
                border: "1px solid #E8E0D0",
              }}>
                <div style={{
                  fontSize: "clamp(2rem, 4vw, 3rem)",
                  color: "#D4A043", fontWeight: 800,
                  marginBottom: "1rem",
                  fontFamily: "Inter, system-ui, sans-serif",
                }}>
                  {step.num}
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0D0A06", marginBottom: "0.6rem", letterSpacing: "-0.01em" }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 14, color: "#6B6252", lineHeight: 1.65 }}>
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── DEPARTMENTS GRID ────────────────────────────────────────────────── */}
      <section style={{ padding: "clamp(3rem, 6vw, 5rem) clamp(1.25rem, 4vw, 2.5rem)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "clamp(2rem, 4vw, 3rem)" }}>
            <h2 style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
              fontWeight: 800, color: "#0D0A06",
              letterSpacing: "-0.02em", marginBottom: "0.6rem",
            }}>
              Your specialists. On demand.
            </h2>
            <p style={{ fontSize: 16, color: "#6B6252", maxWidth: 520, margin: "0 auto" }}>
              Each department is a crew of AI agents trained on the real practices of marketing, strategy, and creative specialists.
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "1.25rem",
          }}>
            {[
              {
                icon: "◎", name: "Research", color: "#4F8EF0",
                category: "Market Research & Competitive Analysis",
                desc: "5-layer deep research with source verification. Know your market before you spend a rupee.",
                eta: "~4 min",
              },
              {
                icon: "◈", name: "Identity", color: "#E8A020",
                category: "Brand Strategy & Visual Identity",
                desc: "Positioning, archetypes, visual language, brand voice. The complete story of who you are.",
                eta: "~15 min",
              },
              {
                icon: "◉", name: "Social Media", color: "#9B5DE5",
                category: "Social Media & Content",
                desc: "30-day content calendars, platform strategies, caption frameworks. Built for your audience.",
                eta: "~12 min",
              },
              {
                icon: "◆", name: "Growth", color: "#F15B50",
                category: "Ad Campaigns & GTM",
                desc: "Meta and Google campaign structures, audience targeting, ad copy sets. Built to convert.",
                eta: "~10 min",
              },
              {
                icon: "◇", name: "Decks", color: "#2DAA6E",
                category: "Pitch Decks & Proposals",
                desc: "Scoped business proposals with pricing, ready to send to clients or investors.",
                eta: "~6 min",
              },
              {
                icon: "⚡", name: "Shopify", color: "#96BF48",
                category: "Shopify Store Intelligence",
                desc: "Connect your store. The AI agent reviews your products, collections, and analytics — then gives you a prioritized action plan: which products to run ads on, what sections to reorganize, what to A/B test.",
                eta: "coming-soon",
              },
            ].map(dept => {
              const isShopify = dept.eta === "coming-soon";
              return (
                <div key={dept.name} style={{
                  background: "#ffffff",
                  borderRadius: 16,
                  borderTop: `3px solid ${dept.color}`,
                  border: isShopify ? `1.5px dashed ${dept.color}60` : `1px solid #E8E0D0`,
                  borderTopWidth: 3,
                  borderTopColor: dept.color,
                  borderTopStyle: "solid",
                  padding: "1.5rem",
                  display: "flex", flexDirection: "column",
                  boxShadow: "0 2px 16px rgba(13,10,6,0.05)",
                  opacity: isShopify ? 0.85 : 1,
                }}>
                  {/* Icon */}
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: dept.color + "18",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 20, color: dept.color,
                    marginBottom: "1rem", flexShrink: 0,
                  }}>
                    {dept.icon}
                  </div>

                  {/* Name + category */}
                  <p style={{ fontSize: 11, fontWeight: 600, color: dept.color, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "0.25rem" }}>
                    {dept.category}
                  </p>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: "#0D0A06", marginBottom: "0.6rem", letterSpacing: "-0.01em" }}>
                    {dept.name}
                  </h3>

                  {/* Desc */}
                  <p style={{ fontSize: 13, color: "#6B6252", lineHeight: 1.65, flex: 1 }}>
                    {dept.desc}
                  </p>

                  {/* Bottom */}
                  <div style={{ marginTop: "1.1rem", paddingTop: "0.9rem", borderTop: "1px solid #E8E0D0" }}>
                    {isShopify ? (
                      <span style={{
                        display: "inline-block",
                        fontSize: 11, fontWeight: 700, color: "#96BF48",
                        background: "rgba(150,191,72,0.12)",
                        border: "1.5px solid rgba(150,191,72,0.35)",
                        borderRadius: 100, padding: "0.25rem 0.75rem",
                        letterSpacing: "0.04em",
                      }}>
                        Coming Soon
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: "#B8AD9E", fontWeight: 500 }}>
                        Typical time: <strong style={{ color: "#6B6252" }}>{dept.eta}</strong>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── COMPARISON TABLE ────────────────────────────────────────────────── */}
      <section style={{ background: "#F5F0E8", padding: "clamp(3rem, 6vw, 5rem) clamp(1.25rem, 4vw, 2.5rem)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "clamp(2rem, 4vw, 3rem)" }}>
            <h2 style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
              fontWeight: 800, color: "#0D0A06",
              letterSpacing: "-0.02em", marginBottom: "0.5rem",
            }}>
              Agencies take months. Your agents take minutes.
            </h2>
            <p style={{ fontSize: 16, color: "#D4A043", fontWeight: 700 }}>Same output quality. A fraction of the time and cost.</p>
          </div>

          <div style={{
            background: "#ffffff",
            borderRadius: 16, overflow: "hidden",
            boxShadow: "0 4px 32px rgba(13,10,6,0.07)",
            border: "1px solid #E8E0D0",
          }}>
            {/* Table header */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
              background: "#0D0A06",
              padding: "0.9rem 1.5rem",
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#6B6252", letterSpacing: "0.08em", textTransform: "uppercase" }}>Service</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#6B6252", letterSpacing: "0.08em", textTransform: "uppercase" }}>Traditional Agency</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#D4A043", letterSpacing: "0.08em", textTransform: "uppercase" }}>Art Protocol</span>
            </div>

            {/* Table rows */}
            {[
              { service: "Market Research",  trad: "2 weeks · ₹1–2L",     ap: "~4 minutes · Free" },
              { service: "Brand Strategy",   trad: "4–6 weeks · ₹5–15L",  ap: "~15 minutes · 350 Credits" },
              { service: "Social Media Plan",trad: "1 week · ₹50K/mo",    ap: "~12 minutes · 350 Credits" },
              { service: "Ad Campaign Setup",trad: "1–2 weeks · ₹30K+",   ap: "~10 minutes · 400 Credits" },
              { service: "Business Proposal",trad: "3–5 days · ₹20–50K",  ap: "~6 minutes · 180 Credits" },
            ].map((row, i) => (
              <div key={row.service} style={{
                display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                padding: "1.1rem 1.5rem",
                borderBottom: i < 4 ? "1px solid #E8E0D0" : "none",
                alignItems: "center",
                background: i % 2 === 1 ? "#FDFAF5" : "#ffffff",
              }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#0D0A06" }}>{row.service}</span>
                <span style={{ fontSize: 13, color: "#B8AD9E" }}>{row.trad}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ color: "#2DAA6E", fontSize: 14, fontWeight: 700 }}>✓</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#D4A043" }}>{row.ap}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ────────────────────────────────────────────────────── */}
      <section style={{ padding: "clamp(3rem, 6vw, 5rem) clamp(1.25rem, 4vw, 2.5rem)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "clamp(2rem, 4vw, 3rem)" }}>
            <h2 style={{
              fontFamily: "Inter, system-ui, sans-serif",
              fontSize: "clamp(1.75rem, 4vw, 2.75rem)",
              fontWeight: 800, color: "#0D0A06", letterSpacing: "-0.02em",
            }}>
              Founders are launching faster.
            </h2>
          </div>

          <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap" }}>
            {[
              {
                name: "Rhea Kapoor", role: "Founder, Bloom Skincare", initials: "RK", color: "#E8A020",
                quote: "I briefed my brand at 11pm and had a complete market research report by midnight. What my last agency took 3 weeks to deliver, Art Protocol did in 8 minutes. I genuinely could not believe it.",
              },
              {
                name: "Arjun Malhotra", role: "Growth Lead, Zintl", initials: "AM", color: "#4F8EF0",
                quote: "The ad campaign structure it generated was better than what our agency was charging ₹40K/month for. We ran the Meta campaigns directly from the output. ROAS went up 2.3x.",
              },
              {
                name: "Priya Nair", role: "Co-founder, Thrive Foods", initials: "PN", color: "#2DAA6E",
                quote: "Finally something that gets D2C. The social media plan had platform-specific hooks, trending audio suggestions, and a full 30-day calendar. Our engagement went up 4x in the first month.",
              },
            ].map(t => (
              <div key={t.name} style={{
                flex: "1 1 280px",
                background: "#ffffff",
                borderRadius: 16,
                padding: "1.75rem",
                boxShadow: "0 4px 24px rgba(13,10,6,0.07)",
                border: "1px solid #E8E0D0",
                display: "flex", flexDirection: "column",
                position: "relative",
              }}>
                {/* Quote mark */}
                <div style={{
                  position: "absolute", top: 12, left: 20,
                  fontSize: 60, color: "#D4A04320",
                  fontFamily: "Inter, system-ui, sans-serif",
                  lineHeight: 1, fontWeight: 700,
                  pointerEvents: "none",
                }}>
                  "
                </div>

                {/* Stars */}
                <div style={{ color: "#D4A043", fontSize: 14, marginBottom: "0.9rem", letterSpacing: "0.05em" }}>★★★★★</div>

                {/* Quote */}
                <p style={{
                  fontSize: 14, color: "#0D0A06",
                  lineHeight: 1.7, flex: 1,
                  fontStyle: "italic",
                }}>
                  "{t.quote}"
                </p>

                {/* Author */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "1.25rem", paddingTop: "1rem", borderTop: "1px solid #E8E0D0" }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: "50%",
                    background: t.color,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{t.initials}</span>
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#0D0A06" }}>{t.name}</p>
                    <p style={{ fontSize: 12, color: "#B8AD9E" }}>{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── INVESTOR STRIP ──────────────────────────────────────────────────── */}
      <section style={{
        background: "#0D0A06",
        padding: "2.5rem clamp(1.25rem, 4vw, 2.5rem)",
        textAlign: "center",
      }}>
        <p style={{ fontSize: 13, color: "#6B6252", marginBottom: "1.5rem", letterSpacing: "0.02em" }}>
          Trusted by founders and backed by investors who believe AI will reshape how brands are built.
        </p>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: "clamp(1.5rem, 4vw, 3.5rem)", flexWrap: "wrap",
        }}>
          {["Sequoia Scout Program", "Antler India", "Operator Angels", "500 Global"].map(inv => (
            <span key={inv} style={{
              fontSize: 13, fontWeight: 700, color: "#3A3020",
              letterSpacing: "0.04em", textTransform: "uppercase",
              userSelect: "none",
            }}>
              {inv}
            </span>
          ))}
        </div>
      </section>

      {/* ─── FINAL CTA ───────────────────────────────────────────────────────── */}
      <section style={{
        background: "#FDFAF5",
        padding: "clamp(4rem, 8vw, 7rem) clamp(1.25rem, 4vw, 2.5rem)",
        textAlign: "center",
      }}>
        <div style={{ maxWidth: 620, margin: "0 auto" }}>
          <h2 style={{
            fontFamily: "Inter, system-ui, sans-serif",
            fontSize: "clamp(2rem, 5vw, 3.25rem)",
            fontWeight: 800, color: "#0D0A06",
            letterSpacing: "-0.02em", lineHeight: 1.15,
            marginBottom: "1rem",
          }}>
            Your brand team is ready.
          </h2>
          <p style={{ fontSize: 16, color: "#6B6252", lineHeight: 1.65, marginBottom: "2.25rem" }}>
            Start with 100 free credits. Brief your brand and watch your specialists go to work — no agency, no waiting, no compromise.
          </p>
          <Link href="/signup" style={{
            display: "inline-block",
            padding: "0.95rem 2.25rem",
            background: "#0D0A06", color: "#ffffff",
            fontWeight: 700, fontSize: 15,
            borderRadius: 12, textDecoration: "none",
            letterSpacing: "0.01em",
            boxShadow: "0 8px 32px rgba(13,10,6,0.2)",
          }}>
            Deploy your first specialist →
          </Link>
          <p style={{ marginTop: "1.25rem", fontSize: 13, color: "#B8AD9E", display: "flex", alignItems: "center", justifyContent: "center", gap: "1.25rem", flexWrap: "wrap" }}>
            <span>✓ 100 credits included</span>
            <span>✓ 5 departments</span>
            <span>✓ PDF downloads</span>
            <span>✓ No card required</span>
          </p>
        </div>
      </section>

      {/* ─── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop: "1px solid #E8E0D0",
        padding: "1.25rem clamp(1.25rem, 4vw, 2.5rem)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: "0.75rem",
        background: "#FDFAF5",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <img src='/ap-logo.png' alt='Art Protocol' style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "#0D0A06" }}>Art Protocol</span>
          <span style={{ fontSize: 12, color: "#B8AD9E" }}>© 2026</span>
        </div>
        <Link href="/login" style={{ fontSize: 12, color: "#B8AD9E", textDecoration: "none" }}>
          Admin sign in
        </Link>
      </footer>

    </main>
  );
}
