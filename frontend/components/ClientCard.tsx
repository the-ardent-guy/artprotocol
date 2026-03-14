import Link from "next/link";
import { Client } from "@/lib/types";
import clsx from "clsx";

interface Props {
  client: Client;
}

const CREW_LABELS: Record<string, string> = {
  branding: "Brand",
  social:   "Social",
  ads:      "Ads",
  proposal: "Proposal",
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ClientCard({ client }: Props) {
  const anyDone = Object.values(client.crews_done).some(Boolean);
  const lastRun = formatDate(client.last_run);

  return (
    <Link href={`/client/${client.name}`}>
      <div className="group bg-[#111] border border-[#1e1e1e] rounded-lg p-5 card-hover cursor-pointer h-full flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-white text-sm tracking-wide">
              {client.name.replace(/_/g, " ")}
            </h3>
            {lastRun ? (
              <p className="text-xs text-[#555] mt-0.5">Last run {lastRun}</p>
            ) : (
              <p className="text-xs text-[#444] mt-0.5">No runs yet</p>
            )}
          </div>
          {/* Status dot */}
          <div
            className={clsx(
              "w-2 h-2 rounded-full mt-1",
              anyDone ? "bg-amber-500" : "bg-[#333]"
            )}
          />
        </div>

        {/* Brief indicator */}
        <div className="flex items-center gap-1.5">
          <div
            className={clsx(
              "w-1.5 h-1.5 rounded-full",
              client.has_brief ? "bg-green-500" : "bg-[#333]"
            )}
          />
          <span className="text-xs text-[#555]">
            {client.has_brief ? "Brief ready" : "No brief"}
          </span>
        </div>

        {/* Crew pills */}
        <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
          {Object.entries(client.crews_done).map(([crew, done]) => (
            <span
              key={crew}
              className={clsx(
                "text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-wider",
                done
                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  : "bg-[#161616] text-[#444] border border-[#222]"
              )}
            >
              {CREW_LABELS[crew]}
            </span>
          ))}
        </div>

        {/* Hover arrow */}
        <div className="text-[#333] group-hover:text-amber-500 transition-colors text-xs font-mono mt-1">
          Open →
        </div>
      </div>
    </Link>
  );
}
