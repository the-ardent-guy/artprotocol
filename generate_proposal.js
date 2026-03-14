const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, AlignmentType, LevelFormat, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageBreak
} = require('docx');
const fs = require('fs');
const path = require('path');

const BLACK = "1A1A1A";
const GREY  = "888888";
const LGREY = "EEEEEE";
const FONT  = "Arial";
const W     = 9026;

const logoBuffer = fs.readFileSync(path.join(__dirname, 'ap_logo_rgba.png'));

const none  = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noneB = { top: none, bottom: none, left: none, right: none };
const rule  = { style: BorderStyle.SINGLE, size: 4, color: LGREY };

const numbering = {
  config: [{
    reference: "bullets",
    levels: [{
      level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 480, hanging: 300 } }, run: { font: FONT, size: 20, color: BLACK } }
    }]
  }]
};

const gap = (n=200) => new Paragraph({ spacing: { before: 0, after: n }, children: [new TextRun({ text: "" })] });

function logoTopRight(size=48) {
  return new Paragraph({
    alignment: AlignmentType.RIGHT,
    spacing: { before: 0, after: 360 },
    children: [new ImageRun({ data: logoBuffer, transformation: { width: size, height: size }, type: "png" })]
  });
}

function divider() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LGREY, space: 1 } },
    spacing: { before: 400, after: 400 }
  });
}

function h1(text) {
  return new Paragraph({
    spacing: { before: 80, after: 280 },
    children: [new TextRun({ text, font: FONT, size: 30, bold: true, color: BLACK })]
  });
}

function h2(text) {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    children: [new TextRun({ text, font: FONT, size: 24, bold: true, color: BLACK })]
  });
}

function body(text, opts={}) {
  return new Paragraph({
    spacing: { before: 0, after: 160 },
    children: [new TextRun({ text, font: FONT, size: 21, color: BLACK, ...opts })]
  });
}

function small(text, opts={}) {
  return new Paragraph({
    spacing: { before: 0, after: 80 },
    children: [new TextRun({ text, font: FONT, size: 18, color: GREY, ...opts })]
  });
}

function bullet(text) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, font: FONT, size: 20, color: BLACK })]
  });
}

function cell(text, width, opts={}, headerLine=false) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: { top: none, bottom: headerLine ? rule : none, left: none, right: none },
    margins: { top: 140, bottom: 140, left: opts.right ? 120 : 0, right: opts.right ? 0 : 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: opts.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
      children: [new TextRun({ text, font: FONT, size: 20, bold: !!opts.bold, color: BLACK })]
    })]
  });
}

// ══════════════════════════════════════════════════════
// PROPOSAL
// ══════════════════════════════════════════════════════
function generateProposal(d) {
  const ch = [];

  // PAGE 1 — Philosophy + Intro
  ch.push(logoTopRight(52));
  ch.push(new Paragraph({
    spacing: { before: 480, after: 360 },
    children: [new TextRun({
      text: "At Art Protocol, we believe strong brands are built on clarity of philosophy and the discipline to express it consistently.",
      font: FONT, size: 26, bold: true, color: BLACK
    })]
  }));
  d.introParagraphs.forEach(p => ch.push(body(p)));
  ch.push(new Paragraph({ children: [new PageBreak()] }));

  // SERVICES PAGES
  d.services.forEach((svc, i) => {
    ch.push(logoTopRight(44));
    ch.push(h1(svc.name));
    ch.push(body(svc.description));
    ch.push(gap(80));
    ch.push(new Paragraph({ spacing: { before: 0, after: 100 }, children: [new TextRun({ text: "Deliverables:", font: FONT, size: 21, bold: true, color: BLACK })] }));
    svc.deliverables.forEach(dv => ch.push(bullet(dv)));
    ch.push(divider());
    if (i < d.services.length - 1) ch.push(new Paragraph({ children: [new PageBreak()] }));
  });
  ch.push(new Paragraph({ children: [new PageBreak()] }));

  // COMMERCIALS
  ch.push(logoTopRight(44));
  ch.push(h1("Commercials"));
  ch.push(gap(160));

  ch.push(new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [2500, 4526, 2000],
    rows: [
      new TableRow({ children: [cell("Services", 2500, { bold: true }, true), cell("Description", 4526, { bold: true }, true), cell("Investment", 2000, { bold: true, right: true }, true)] }),
      ...d.services.map(svc => new TableRow({
        children: [
          new TableCell({
            width: { size: 2500, type: WidthType.DXA },
            borders: { top: none, bottom: rule, left: none, right: none },
            margins: { top: 160, bottom: 160, left: 0, right: 120 },
            children: [
              new Paragraph({ children: [new TextRun({ text: svc.name, font: FONT, size: 20, bold: true, color: BLACK })] }),
              new Paragraph({ spacing: { before: 60 }, children: [new TextRun({ text: `Timeline: ${svc.timeline}`, font: FONT, size: 18, color: GREY })] })
            ]
          }),
          new TableCell({
            width: { size: 4526, type: WidthType.DXA },
            borders: { top: none, bottom: rule, left: none, right: none },
            margins: { top: 160, bottom: 160, left: 120, right: 120 },
            children: [new Paragraph({ children: [new TextRun({ text: svc.commercialDesc, font: FONT, size: 20, color: BLACK })] })]
          }),
          new TableCell({
            width: { size: 2000, type: WidthType.DXA },
            borders: { top: none, bottom: rule, left: none, right: none },
            margins: { top: 160, bottom: 160, left: 120, right: 0 },
            verticalAlign: VerticalAlign.CENTER,
            children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: svc.price, font: FONT, size: 20, color: BLACK })] })]
          })
        ]
      }))
    ]
  }));

  ch.push(gap(400));
  ch.push(h2("Discounted Consolidated Package"));
  ch.push(gap(80));

  ch.push(new Table({
    width: { size: W, type: WidthType.DXA },
    columnWidths: [6026, 3000],
    rows: [new TableRow({
      children: [
        new TableCell({
          width: { size: 6026, type: WidthType.DXA }, borders: noneB,
          shading: { fill: "F7F7F7", type: ShadingType.CLEAR },
          margins: { top: 160, bottom: 160, left: 200, right: 120 },
          children: d.services.map(s => new Paragraph({ spacing: { before: 40, after: 40 }, children: [new TextRun({ text: s.name, font: FONT, size: 20, color: BLACK })] }))
        }),
        new TableCell({
          width: { size: 3000, type: WidthType.DXA }, borders: noneB,
          shading: { fill: "F7F7F7", type: ShadingType.CLEAR },
          margins: { top: 160, bottom: 160, left: 120, right: 200 },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: d.totalPrice, font: FONT, size: 19, color: GREY, strike: true })] }),
            new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 80 }, children: [new TextRun({ text: d.discountedPrice, font: FONT, size: 24, bold: true, color: BLACK })] })
          ]
        })
      ]
    })]
  }));

  ch.push(new Paragraph({ children: [new PageBreak()] }));

  // PAYMENT TERMS
  ch.push(logoTopRight(44));
  ch.push(h1("Payment Terms"));
  d.paymentTerms.forEach(pt => { ch.push(h2(pt.phase)); pt.terms.forEach(t => ch.push(bullet(t))); });
  ch.push(divider());
  ch.push(h2("Resources Deployed"));
  d.resources.forEach(r => ch.push(bullet(r)));
  ch.push(divider());
  ch.push(h2("Governance"));
  d.governance.forEach(g => ch.push(bullet(g)));
  ch.push(new Paragraph({ children: [new PageBreak()] }));

  // RECENT WORK
  ch.push(logoTopRight(44));
  ch.push(h1("Our Recent Work"));
  ch.push(body("We've worked across industries — luxury, consultancy, packaging, and healthcare — bringing real ROI and brand elevation."));
  ch.push(gap(120));
  ch.push(body("Selected Works:"));
  d.recentWork.forEach(w => ch.push(bullet(w)));
  ch.push(new Paragraph({ children: [new PageBreak()] }));

  // CLOSING
  ch.push(gap(1200));
  ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 480 }, children: [new ImageRun({ data: logoBuffer, transformation: { width: 80, height: 80 }, type: "png" })] }));
  ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 240 }, children: [new TextRun({ text: "You'll get a team that's worked with supercars to healthcare, and still sweats the small details that make a brand memorable.", font: FONT, size: 22, color: BLACK })] }));
  ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 600 }, children: [new TextRun({ text: "Let's build not just a brand, but an experience.", font: FONT, size: 22, bold: true, color: BLACK })] }));
  ch.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 60 }, children: [new TextRun({ text: "Art Protocol", font: FONT, size: 22, bold: true, color: BLACK })] }));
  ch.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Design & Strategy Partner", font: FONT, size: 20, color: GREY })] }));

  return new Document({ numbering, styles: { default: { document: { run: { font: FONT, size: 21, color: BLACK } } } }, sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children: ch }] });
}

// ══════════════════════════════════════════════════════
// CONTRACT
// ══════════════════════════════════════════════════════
function generateContract(d) {
  const ch = [];

  ch.push(logoTopRight(44));
  ch.push(gap(80));
  ch.push(new Paragraph({ spacing: { before: 0, after: 100 }, children: [new TextRun({ text: d.client.name, font: FONT, size: 38, bold: true, color: BLACK })] }));
  ch.push(new Paragraph({ spacing: { before: 0, after: 200 }, children: [new TextRun({ text: d.subtitle, font: FONT, size: 26, bold: true, color: BLACK })] }));
  ch.push(new Paragraph({ spacing: { before: 0, after: 80 }, children: [new TextRun({ text: "Prepared by: ", font: FONT, size: 21, bold: true, color: BLACK }), new TextRun({ text: "Art Protocol", font: FONT, size: 21, color: BLACK })] }));
  ch.push(new Paragraph({ spacing: { before: 0, after: 80 }, children: [new TextRun({ text: "For: ", font: FONT, size: 21, bold: true, color: BLACK }), new TextRun({ text: d.client.name, font: FONT, size: 21, color: BLACK })] }));
  ch.push(divider());

  ch.push(h1("Scope of Work"));
  d.services.forEach((svc, i) => {
    ch.push(logoTopRight(36));
    ch.push(h2(`${i + 1}. ${svc.name}`));
    ch.push(new Paragraph({ spacing: { before: 0, after: 80 }, children: [new TextRun({ text: `Timeline: ${svc.timeline}`, font: FONT, size: 21, bold: true, color: BLACK })] }));
    ch.push(body(svc.description));
    ch.push(new Paragraph({ spacing: { before: 120, after: 100 }, children: [new TextRun({ text: "Deliverables", font: FONT, size: 21, bold: true, color: BLACK })] }));
    svc.deliverables.forEach(dv => ch.push(bullet(dv)));
    ch.push(divider());
  });

  ch.push(logoTopRight(36));
  ch.push(h1("Consolidated Investment"));
  ch.push(new Paragraph({ spacing: { before: 0, after: 160 }, children: [new TextRun({ text: "The client has opted for the ", font: FONT, size: 21, color: BLACK }), new TextRun({ text: "discounted consolidated package", font: FONT, size: 21, bold: true, color: BLACK }), new TextRun({ text: " covering:", font: FONT, size: 21, color: BLACK })] }));
  d.services.forEach(s => ch.push(bullet(s.name)));
  ch.push(gap(200));
  ch.push(new Paragraph({ spacing: { before: 0, after: 60 }, children: [new TextRun({ text: "Total Investment:", font: FONT, size: 21, bold: true, color: BLACK })] }));
  ch.push(new Paragraph({ spacing: { before: 0, after: 120 }, children: [new TextRun({ text: d.totalInvestment, font: FONT, size: 26, bold: true, color: BLACK })] }));
  ch.push(small("(Social media management can be activated separately if required.)", { italics: true }));
  ch.push(divider());

  ch.push(logoTopRight(36));
  ch.push(h1("Project Timeline"));
  ch.push(gap(120));
  ch.push(new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: [5026, 4000],
    rows: [
      new TableRow({ children: [cell("Phase", 5026, { bold: true }, true), cell("Duration", 4000, { bold: true }, true)] }),
      ...d.services.map(s => new TableRow({ children: [cell(s.name, 5026, {}, false), cell(s.timeline, 4000, {}, false)] }))
    ]
  }));
  ch.push(gap(200));
  ch.push(new Paragraph({ spacing: { before: 0, after: 80 }, children: [new TextRun({ text: "Estimated Total Timeline: ", font: FONT, size: 21, bold: true, color: BLACK }), new TextRun({ text: d.totalTimeline, font: FONT, size: 21, color: BLACK })] }));
  ch.push(divider());

  ch.push(logoTopRight(36));
  ch.push(h1("Project Investment & Milestones"));
  ch.push(new Paragraph({ spacing: { before: 0, after: 160 }, children: [new TextRun({ text: "Total Project Investment: ", font: FONT, size: 21, color: BLACK }), new TextRun({ text: d.totalInvestment, font: FONT, size: 21, bold: true, color: BLACK })] }));
  ch.push(body("Payments are structured across project stages to ensure clarity and alignment."));
  d.stages.forEach(stage => {
    ch.push(h2(stage.name));
    ch.push(new Paragraph({ spacing: { before: 0, after: 80 }, children: [new TextRun({ text: "Investment: ", font: FONT, size: 21, bold: true, color: BLACK }), new TextRun({ text: stage.investment, font: FONT, size: 21, color: BLACK })] }));
    ch.push(body(stage.includes));
    ch.push(new Paragraph({ spacing: { before: 80, after: 60 }, children: [new TextRun({ text: "Payment due:", font: FONT, size: 21, bold: true, color: BLACK })] }));
    ch.push(body(stage.paymentDue));
    ch.push(divider());
  });

  ch.push(logoTopRight(36));
  ch.push(body("All payments can be made via bank transfer or UPI using the details below."));
  ch.push(h1("Payment Details"));
  Object.entries(d.paymentDetails).forEach(([k, v]) => {
    ch.push(new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun({ text: `${k}: `, font: FONT, size: 21, bold: true, color: BLACK }), new TextRun({ text: v, font: FONT, size: 21, color: BLACK })] }));
  });
  ch.push(gap(200));
  ch.push(h2("Payment Finality"));
  ch.push(new Paragraph({ spacing: { before: 0, after: 200 }, children: [new TextRun({ text: "Payments made against approved milestones are ", font: FONT, size: 21, color: BLACK }), new TextRun({ text: "final and non-refundable", font: FONT, size: 21, bold: true, color: BLACK }), new TextRun({ text: ", as they represent work already completed and resources committed to the project.", font: FONT, size: 21, color: BLACK })] }));
  ch.push(divider());

  ch.push(logoTopRight(36));
  ch.push(h1("Governance"));
  d.governance.forEach(g => ch.push(bullet(g)));
  ch.push(divider());
  ch.push(h1("Jurisdiction"));
  ch.push(body(d.jurisdiction));
  ch.push(divider());

  ch.push(logoTopRight(36));
  ch.push(h1("Client Responsibilities"));
  ch.push(body("The client agrees to provide:"));
  d.clientResponsibilities.forEach(r => ch.push(bullet(r)));
  ch.push(small("Delays in providing required information may affect project timelines.", { italics: true }));
  ch.push(divider());
  ch.push(h1("Intellectual Property"));
  ch.push(body("Upon full payment, the client receives rights to use final design assets for business purposes."));
  ch.push(body("Art Protocol retains the right to showcase the work in its portfolio unless otherwise agreed."));
  ch.push(divider());
  ch.push(h1("Acceptance"));
  ch.push(gap(200));
  ch.push(new Paragraph({ spacing: { before: 0, after: 320 }, children: [new TextRun({ text: `Client: ${d.client.name}`, font: FONT, size: 21, color: BLACK })] }));
  ch.push(body("Signature: _______________________"));
  ch.push(gap(400));
  ch.push(new Paragraph({ spacing: { before: 0, after: 80 }, children: [new TextRun({ text: "Agency: ", font: FONT, size: 21, color: BLACK }), new TextRun({ text: "Art Protocol", font: FONT, size: 21, bold: true, color: BLACK })] }));
  ch.push(body("Signature: _______________________"));
  ch.push(body(`Date: ${new Date().toLocaleDateString('en-GB')}`));

  return new Document({ numbering, styles: { default: { document: { run: { font: FONT, size: 21, color: BLACK } } } }, sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } }, children: ch }] });
}

// ══════════════════════════════════════════════════════
// FIXED DATA (never changes)
// ══════════════════════════════════════════════════════
const FIXED = {
  resources:    ["Brand Strategist", "Graphic Designer", "Visual / Graphic Designer", "Digital & Search Strategist", "Our local anna who loves filter coffee."],
  governance:   ["Two rounds of revisions are included within each phase.", "Any revisions or additions beyond the agreed scope will be billed separately.", "Project timelines depend on timely feedback, approvals, and asset sharing."],
  recentWork:   ["Boit Club — Luxury Lifestyle & Car Club — www.boit.club", "Sintero — Premium Sintered Slabs — www.sintero.in", "Bizotico — Luxury Watch Ecom (7x ROAS) — www.bizotico.com", "VIST Labs — US Packaging Tech Brand", "Vault Apps — Sophisticated lifecycle storytelling", "CannesPRLions / Lions News — Story-driven editorial visuals", "Studio Size — Branding-forward, intuitive design", "Linde Energy — A corporate face for energy giants", "Epistic — Full Cycle Product Launch", "Koodai Kind — www.koodaikind.com"],
  paymentDetails: { "Account Name": "Rishabh Kumar R", "Bank": "Federal Bank – Neo Banking (Jupiter)", "Account Number": "77770102739600", "IFSC Code": "FDRL0007777", "Alternate IFSC": "FDRL0000001", "Branch": "Neo Banking – Jupiter", "UPI ID": "6362310396@jupiteraxis" },
  contractGovernance: ["Two rounds of revisions are included within each phase.", "Additional revisions or scope changes beyond defined deliverables may incur additional charges.", "Project timelines depend on timely feedback, approvals, and asset sharing."],
  jurisdiction: "This Agreement shall be governed by and construed in accordance with the laws of India. Any disputes arising out of or in connection with this Agreement shall be subject to the exclusive jurisdiction of the courts of Bengaluru, Karnataka.",
  clientResponsibilities: ["Product images and brand assets", "Product details (pricing, descriptions, SKUs)", "Website content unless otherwise agreed"],
  contractStages: [
    { name: "Stage 1 — Discovery & Brand Foundations", pct: "30%", includes: "Includes brand research, archetype exploration, and strategic groundwork.",            paymentDue: "Upon signing the agreement and prior to commencement of work." },
    { name: "Stage 2 — Brand Identity Development",    pct: "25%", includes: "Includes logo development, visual identity design, typography and colour system.",      paymentDue: "Upon approval of brand direction and prior to delivery of finalized brand identity assets." },
    { name: "Stage 3 — Digital Experience",            pct: "25%", includes: "Includes UX/UI design, development, and integration.",                                   paymentDue: "Upon completion of development and prior to launch." },
    { name: "Stage 4 — Launch & System Setup",         pct: "20%", includes: "Includes final testing, automation setup, and delivery of all brand assets.",            paymentDue: "Upon delivery of final assets and prior to go-live." }
  ]
};

// ══════════════════════════════════════════════════════
// SERVICE LIBRARY — pick from these during intake
// ══════════════════════════════════════════════════════
const SERVICE_LIBRARY = {
  "1": {
    name: "Brand Strategy & Visual Identity", timeline: "4 weeks",
    description: "This phase focuses on building a clear, globally relevant brand system — translating the brand's philosophy into a cohesive visual and narrative identity.",
    commercialDesc: "Research, positioning, and design of a cohesive brand identity aligned with the brand's philosophy and growth direction.",
    deliverables: ["Brand archetype and positioning research", "Market and competitor analysis", "Brand narrative and messaging framework", "Logo exploration and identity development", "Typography and colour palette system", "Visual direction and brand guidelines"],
    paymentTerms: ["Full phase investment payable upon project confirmation", "Project work commences immediately upon confirmation"]
  },
  "2": {
    name: "Shopify Design & Development", timeline: "6 weeks",
    description: "This phase focuses on building a high-converting digital storefront — designed to let the product lead, supported by thoughtful UX and structure.",
    commercialDesc: "Design and build of a global-ready Shopify experience focused on clarity, flow, and product-led conversion.",
    deliverables: ["UX and UI design for core pages (Home, Collection, Product, About)", "Shopify storefront setup and development", "Upload and configuration of up to 40 product pages", "Payment gateway integration and mobile responsive optimisation"],
    paymentTerms: ["50% upon phase activation", "50% prior to launch and delivery of final assets"]
  },
  "3": {
    name: "Social Media Management", timeline: "Monthly",
    description: "This phase focuses on building a consistent, engaged, and on-brand social presence to support growth.",
    commercialDesc: "Platform-specific content strategy aligned with the brand's philosophy and release cadence.",
    deliverables: ["Social media strategy aligned with brand direction", "Content planning and rollout", "Community and query management", "Engagement building through consistent interaction", "Monthly performance reporting"],
    paymentTerms: ["Billed monthly in advance"]
  },
  "4": {
    name: "Content & Discovery Setup", timeline: "3 weeks (parallel)",
    description: "This phase focuses on improving discoverability through structured content and search readiness.",
    commercialDesc: "Search-informed content structuring to improve organic visibility and modern AI-driven discovery.",
    deliverables: ["Keyword research for the category", "Search-informed website content structure", "Metadata and page description planning", "SEO readiness for Shopify and AI-driven discovery"],
    paymentTerms: ["50% upon phase activation", "50% upon completion of setup"]
  },
  "5": {
    name: "Email Marketing Setup", timeline: "3 weeks (parallel)",
    description: "This phase focuses on building automated communication systems for customer engagement, recovery, and retention.",
    commercialDesc: "Setup of essential email automations to support cart recovery, post-purchase engagement, and customer retention.",
    deliverables: ["Email platform setup integrated with Shopify", "Abandoned cart and browse abandonment automation", "Post-purchase email flow", "Branded email templates aligned with the brand identity"],
    paymentTerms: ["50% upon phase activation", "50% upon completion of setup"]
  },
  "6": {
    name: "Performance Marketing", timeline: "Monthly",
    description: "This phase focuses on running targeted paid campaigns across Meta and Google to drive measurable growth.",
    commercialDesc: "End-to-end paid media management across Meta and Google — strategy, creative, execution, and reporting.",
    deliverables: ["Paid media strategy and campaign structure", "Ad copy and creative direction", "Campaign setup and launch", "Weekly optimisation and performance reporting", "Monthly review and scaling decisions"],
    paymentTerms: ["Billed monthly in advance"]
  }
};

// ══════════════════════════════════════════════════════
// INTERACTIVE INTAKE
// ══════════════════════════════════════════════════════
const readline = require('readline');

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, answer => resolve(answer.trim())));
}

async function runIntake() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("\n" + "═".repeat(50));
  console.log("  ART PROTOCOL — PROPOSAL & CONTRACT GENERATOR");
  console.log("═".repeat(50) + "\n");

  // ── BASIC INFO ───────────────────────────────────
  const clientName  = await ask(rl, "1.  Client name: ");
  const intro1      = await ask(rl, "2.  One sentence about the client's brand / what they do: ");
  const intro2      = await ask(rl, "3.  One sentence about what AP's role will be: ");

  // ── SERVICE SELECTION ────────────────────────────
  console.log("\n── SERVICES ─────────────────────────────────────");
  console.log("  1.  Brand Strategy & Visual Identity");
  console.log("  2.  Shopify Design & Development");
  console.log("  3.  Social Media Management");
  console.log("  4.  Content & Discovery Setup");
  console.log("  5.  Email Marketing Setup");
  console.log("  6.  Performance Marketing");
  console.log("─────────────────────────────────────────────────");

  const svcInput    = await ask(rl, "Enter service numbers (e.g. 1,2,3): ");
  const svcNumbers  = svcInput.split(",").map(s => s.trim()).filter(s => SERVICE_LIBRARY[s]);
  const services    = svcNumbers.map(n => ({ ...SERVICE_LIBRARY[n] }));

  if (services.length === 0) {
    console.log("No valid services selected. Exiting.");
    rl.close(); return;
  }

  // ── PRICING ──────────────────────────────────────
  console.log("\n── PRICING ──────────────────────────────────────");
  for (const svc of services) {
    svc.price = await ask(rl, `  Price for "${svc.name}": INR `);
    svc.price = `INR ${svc.price}`;
  }

  const totalPrice      = await ask(rl, "\n  Total before discount (leave blank to skip): INR ");
  const discountedPrice = await ask(rl, "  Discounted package price: INR ");
  const totalTimeline   = await ask(rl, "\n  Total project timeline (e.g. 10-11 weeks): ");

  rl.close();

  // ── BUILD DATA ───────────────────────────────────
  const totalInvestment = `INR ${discountedPrice}`;

  const proposalData = {
    client: { name: clientName },
    introParagraphs: [
      `${clientName} ${intro1}`,
      `${intro2}`
    ],
    services,
    totalPrice:      totalPrice      ? `INR ${totalPrice}`      : `INR ${discountedPrice}`,
    discountedPrice: `INR ${discountedPrice}`,
    paymentTerms: services.map(svc => ({ phase: svc.name, terms: svc.paymentTerms })),
    resources:    FIXED.resources,
    governance:   FIXED.governance,
    recentWork:   FIXED.recentWork
  };

  // Calculate stage amounts from discounted total
  const total = parseInt(discountedPrice.replace(/[^0-9]/g, '')) || 0;
  const stages = FIXED.contractStages.map(s => {
    const pctNum = parseInt(s.pct) / 100;
    const amt    = total ? `INR ${Math.round(total * pctNum).toLocaleString('en-IN')}` : "INR [AMOUNT]";
    return { ...s, investment: `${amt} (${s.pct})` };
  });

  const contractData = {
    client:                 { name: clientName },
    subtitle:               "Brand Identity & Growth Partnership",
    services,
    totalInvestment,
    totalTimeline:          `Approximately ${totalTimeline}`,
    stages,
    paymentDetails:         FIXED.paymentDetails,
    governance:             FIXED.contractGovernance,
    jurisdiction:           FIXED.jurisdiction,
    clientResponsibilities: FIXED.clientResponsibilities
  };

  return { clientName, proposalData, contractData };
}

// ══════════════════════════════════════════════════════
// RUN
// ══════════════════════════════════════════════════════
async function main() {
  const intake = await runIntake();
  if (!intake) return;

  const { clientName, proposalData, contractData } = intake;
  const safe = clientName.replace(/\s+/g, '_');

  console.log(`\n⏳ Generating documents for ${clientName}...`);

  const [propBuf, contBuf] = await Promise.all([
    Packer.toBuffer(generateProposal(proposalData)),
    Packer.toBuffer(generateContract(contractData))
  ]);

  const propPath = path.join(__dirname, `${safe}_Proposal.docx`);
  const contPath = path.join(__dirname, `${safe}_Contract.docx`);

  fs.writeFileSync(propPath, propBuf);
  fs.writeFileSync(contPath, contBuf);

  console.log(`\n✓ ${safe}_Proposal.docx`);
  console.log(`✓ ${safe}_Contract.docx`);
  console.log(`\nOpen in Word → fill in any remaining details → save as PDF → send.\n`);
}

main().catch(console.error);
