"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  getBrief, saveBrief, getOutputs, runCrew, getJobStatus
} from "@/lib/api";
import { OutputFile, CrewName, AnyBrief } from "@/lib/types";
import OutputCard from "@/components/OutputCard";
import Terminal from "@/components/Terminal";
import BriefFields from "@/components/BriefFields";

const CREWS: { id: CrewName; label: string; desc: string }[] = [
  { id: "branding",  label: "Branding",  desc: "Brand strategy, identity, positioning" },
  { id: "social",    label: "Social",    desc: "30-day content calendar" },
  { id: "ads",       label: "Ads",       desc: "Meta & Google campaign" },
  { id: "proposal",  label: "Proposal",  desc: "Scoped proposal + pricing" },
  { id: "research",  label: "Research",  desc: "Deep research report" },
];

export default function ClientPage() {
  const { name }   = useParams<{ name: string }>();
  const router     = useRouter();
  // Brief state
  const [briefMd,      setBriefMd]      = useState("");
  const [briefSaving,  setBriefSaving]  = useState(false);
  const [briefSaved,   setBriefSaved]   = useState(false);
  const [briefLoading, setBriefLoading] = useState(true);

  // Crew runner state
  const [selectedCrews,  setSelectedCrews]  = useState<Set<CrewName>>(new Set());
  const [activeCrew,     setActiveCrew]     = useState<CrewName | null>(null);
  const [briefFields,    setBriefFields]    = useState<AnyBrief>({});
  const [crewFormCrew,   setCrewFormCrew]   = useState<CrewName | null>(null);

  // Job state
  const [jobId,     setJobId]     = useState<string | null>(null);
  const [jobLines,  setJobLines]  = useState<string[]>([]);
  const [jobStatus, setJobStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [jobOutput, setJobOutput] = useState<string | null>(null);

  // Outputs
  const [outputs,  setOutputs]  = useState<OutputFile[]>([]);
  const [loadingOutputs, setLoadingOutputs] = useState(false);

  // Tab
  const [tab, setTab] = useState<"brief" | "run" | "outputs">("brief");

  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    loadBrief();
    loadOutputs();
  }, [name]);

  async function loadBrief() {
    setBriefLoading(true);
    try {
      const data = await getBrief(name);
      setBriefMd(data.content);
    } catch {}
    setBriefLoading(false);
  }

  async function handleSaveBrief() {
    setBriefSaving(true);
    try {
      await saveBrief(name, briefMd);
      setBriefSaved(true);
      setTimeout(() => setBriefSaved(false), 2000);
    } catch (e: any) {
      alert(e.message);
    }
    setBriefSaving(false);
  }

  async function loadOutputs() {
    setLoadingOutputs(true);
    try {
      const data = await getOutputs(name);
      setOutputs(data);
    } catch {}
    setLoadingOutputs(false);
  }

  function toggleCrew(crew: CrewName) {
    setSelectedCrews((prev) => {
      const next = new Set(prev);
      if (next.has(crew)) next.delete(crew);
      else next.add(crew);
      return next;
    });
  }

  async function startRun(crewsToRun: CrewName[]) {
    if (crewsToRun.length === 0) return;
    const crew = crewsToRun[0]; // run one at a time
    setCrewFormCrew(crew);
  }

  async function submitCrewRun(crew: CrewName, fields: AnyBrief) {
    setCrewFormCrew(null);
    setActiveCrew(crew);
    setJobLines([]);
    setJobStatus("running");
    setJobOutput(null);
    setTab("run");

    try {
      // Find most recent brand doc for context
      const brandOutput = outputs.find((o) => o.crew === "branding");
      const brandDocPath = brandOutput?.path;

      const data = await runCrew(name, crew, fields, brandDocPath);
      setJobId(data.job_id);
      startStreaming(data.job_id);
    } catch (e: any) {
      setJobLines([`[ERROR] ${e.message}`]);
      setJobStatus("error");
    }
  }

  function startStreaming(jid: string) {
    if (eventSourceRef.current) eventSourceRef.current.close();
    const url = `/api/backend/stream/${jid}`;
    const es  = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const data = event.data as string;
      if (data.startsWith("[COMPLETE:")) {
        const parts     = data.slice(10, -1).split(":");
        const status    = parts[0] as "done" | "error";
        const outPath   = parts.slice(1).join(":") || null;
        setJobStatus(status);
        setJobOutput(outPath);
        es.close();
        loadOutputs();
      } else {
        setJobLines((prev) => [...prev, data]);
      }
    };
    es.onerror = () => {
      setJobStatus("error");
      setJobLines((prev) => [...prev, "[ERROR] Stream disconnected"]);
      es.close();
    };
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#1e1e1e] shrink-0">
        <Link href="/dashboard" className="text-[#555] hover:text-[#999] transition-colors">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>
        <div>
          <h1 className="text-sm font-semibold text-white">
            {name.replace(/_/g, " ")}
          </h1>
          <p className="text-xs text-[#555]">
            {outputs.length} output{outputs.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 px-6 border-b border-[#1e1e1e] shrink-0">
        {(["brief", "run", "outputs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-xs uppercase tracking-wider font-medium transition-colors border-b-2 -mb-px ${
              tab === t
                ? "text-amber-400 border-amber-500"
                : "text-[#555] border-transparent hover:text-[#999]"
            }`}
          >
            {t === "brief" ? "Brief" : t === "run" ? "Run Crew" : "Outputs"}
            {t === "run" && jobStatus === "running" && (
              <span className="ml-2 w-1.5 h-1.5 rounded-full bg-amber-500 inline-block animate-pulse-amber" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {/* ── BRIEF TAB ── */}
        {tab === "brief" && (
          <div className="p-6 max-w-3xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-[#999]">Brief — markdown</h2>
              <button
                onClick={handleSaveBrief}
                disabled={briefSaving}
                className="text-xs px-3 py-1.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold rounded transition-colors"
              >
                {briefSaving ? "Saving..." : briefSaved ? "Saved ✓" : "Save"}
              </button>
            </div>
            {briefLoading ? (
              <div className="h-64 bg-[#111] border border-[#1e1e1e] rounded-lg animate-pulse" />
            ) : (
              <textarea
                value={briefMd}
                onChange={(e) => setBriefMd(e.target.value)}
                className="w-full h-[60vh] bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg p-4 text-sm text-[#ccc] font-mono focus:border-amber-500 focus:outline-none resize-none leading-relaxed"
                placeholder="# Client Name&#10;&#10;Write the client brief here in markdown..."
                spellCheck={false}
              />
            )}
          </div>
        )}

        {/* ── RUN TAB ── */}
        {tab === "run" && (
          <div className="p-6 space-y-6 max-w-4xl">
            {/* Crew selector */}
            {jobStatus !== "running" && (
              <div className="space-y-4">
                <h2 className="text-sm font-medium text-[#999]">Select crews to run</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {CREWS.map((crew) => (
                    <button
                      key={crew.id}
                      onClick={() => toggleCrew(crew.id)}
                      className={`text-left p-4 rounded-lg border transition-all ${
                        selectedCrews.has(crew.id)
                          ? "border-amber-500/60 bg-amber-500/5 text-white"
                          : "border-[#2a2a2a] bg-[#111] text-[#666] hover:border-[#3a3a3a] hover:text-[#999]"
                      }`}
                    >
                      <div className="text-xs font-semibold uppercase tracking-wider mb-1">
                        {crew.label}
                      </div>
                      <div className="text-[11px] text-[#555]">{crew.desc}</div>
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    disabled={selectedCrews.size === 0}
                    onClick={() => startRun([...selectedCrews])}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black text-sm font-semibold rounded transition-colors"
                  >
                    Run Selected ({selectedCrews.size})
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCrews(new Set(CREWS.map((c) => c.id)));
                    }}
                    className="px-4 py-2 border border-[#2a2a2a] hover:border-[#3a3a3a] text-[#777] text-sm rounded transition-colors"
                  >
                    Select All
                  </button>
                </div>
              </div>
            )}

            {/* Terminal */}
            {jobStatus !== "idle" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#555] font-mono">
                    {activeCrew?.toUpperCase()} crew
                  </span>
                  <div className="flex items-center gap-2">
                    {jobStatus === "running" && (
                      <span className="flex items-center gap-1.5 text-xs text-amber-400 font-mono">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse-amber" />
                        Running
                      </span>
                    )}
                    {jobStatus === "done" && (
                      <span className="text-xs text-green-400 font-mono">✓ Complete</span>
                    )}
                    {jobStatus === "error" && (
                      <span className="text-xs text-red-400 font-mono">✗ Error</span>
                    )}
                  </div>
                </div>
                <Terminal lines={jobLines} isRunning={jobStatus === "running"} />
                {jobStatus === "done" && (
                  <button
                    onClick={() => {
                      setJobStatus("idle");
                      setTab("outputs");
                    }}
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    View outputs →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── OUTPUTS TAB ── */}
        {tab === "outputs" && (
          <div className="p-6">
            {loadingOutputs ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-24 bg-[#111] border border-[#1e1e1e] rounded-lg animate-pulse" />
                ))}
              </div>
            ) : outputs.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-[#555] text-sm">No outputs yet.</p>
                <p className="text-[#444] text-xs mt-1">
                  Run a crew to generate outputs.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {outputs.map((output) => (
                  <OutputCard
                    key={output.path}
                    output={output}
                    clientName={name}

                  />
                ))}
              </div>
            )}
            <button
              onClick={loadOutputs}
              className="mt-4 text-xs text-[#555] hover:text-[#999] transition-colors"
            >
              Refresh
            </button>
          </div>
        )}
      </div>

      {/* Crew brief form modal */}
      {crewFormCrew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#111] border border-[#2a2a2a] rounded-lg w-full max-w-xl my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e1e1e]">
              <h2 className="text-sm font-semibold text-white capitalize">
                {crewFormCrew} Brief
              </h2>
              <button
                onClick={() => setCrewFormCrew(null)}
                className="text-[#555] hover:text-[#999] transition-colors"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <BriefFields
              crew={crewFormCrew}
              clientName={name}
              onSubmit={(fields) => submitCrewRun(crewFormCrew, fields)}
              onCancel={() => setCrewFormCrew(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
