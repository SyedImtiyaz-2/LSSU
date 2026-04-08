"use client";
import { useEffect, useState } from "react";
import { api, Lead } from "@/lib/api";
import { Download, Search, Trash2 } from "lucide-react";
import { format } from "date-fns";

const ICP_COLORS: Record<string, string> = {
  "Traditional Prospective Student":        "bg-blue-100 text-blue-800",
  "Transfer Prospective Student":           "bg-indigo-100 text-indigo-800",
  "Transfer Back Prospective Student":      "bg-violet-100 text-violet-800",
  "Canadian Cross Border Student":          "bg-red-100 text-red-800",
  "Charter School Student":                 "bg-orange-100 text-orange-800",
  "Indigenous and Anishinaabe Scholar":     "bg-amber-100 text-amber-800",
  "Cannabis Business & Chemistry Student":  "bg-emerald-100 text-emerald-800",
  "Fisheries & Wildlife Student":           "bg-green-100 text-green-800",
  "Fire Science Student":                   "bg-rose-100 text-rose-800",
  "Nursing Student":                        "bg-pink-100 text-pink-800",
  "Robotics Engineering Student":           "bg-cyan-100 text-cyan-800",
  "Collegiate Hockey Athlete (Men's)":      "bg-sky-100 text-sky-800",
  "Collegiate Hockey Athlete (Women's)":    "bg-purple-100 text-purple-800",
  "Agent Chatbot":                          "bg-gray-100 text-gray-600",
};

const SOURCE_MAP: Record<string, { label: string; cls: string }> = {
  agent:  { label: "Agent App",    cls: "bg-[#003F6B] text-white" },
  demo:   { label: "Demo Widget",  cls: "bg-gray-100 text-gray-600" },
  widget: { label: "Widget",       cls: "bg-blue-100 text-blue-700" },
  direct: { label: "Direct",       cls: "bg-green-100 text-green-700" },
};

function IcpBadge({ name }: { name: string | null }) {
  if (!name) return <span className="text-gray-300">—</span>;
  const cls = ICP_COLORS[name] ?? "bg-gray-100 text-gray-600";
  return <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>{name}</span>;
}

function SourceBadge({ source }: { source: string | null }) {
  if (!source) return <span className="text-gray-300">—</span>;
  const s = SOURCE_MAP[source.toLowerCase()] ?? { label: source, cls: "bg-gray-100 text-gray-600" };
  return <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>;
}

const SCORE_STYLE: Record<string, string> = {
  high:   "bg-green-100 text-green-800",
  medium: "bg-amber-100 text-amber-800",
  low:    "bg-gray-100 text-gray-500",
};

function ScoreBadge({ score }: { score: string | null }) {
  if (!score) return <span className="text-gray-300">—</span>;
  const cls = SCORE_STYLE[score] ?? "bg-gray-100 text-gray-500";
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${cls}`}>
      {score}
    </span>
  );
}

export default function LeadsPage() {
  const [leads, setLeads]       = useState<Lead[]>([]);
  const [query, setQuery]       = useState("");
  const [scoreFilter, setScoreFilter] = useState("");
  const [loading, setLoading]   = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Lead | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.leads(0, 200, scoreFilter || undefined)
      .then((r) => setLeads(r.leads))
      .finally(() => setLoading(false));
  }, [scoreFilter]);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteSession(deleteTarget.session_id);
      setLeads((prev) => prev.filter((l) => l.session_id !== deleteTarget.session_id));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = leads.filter((l) => {
    const q = query.toLowerCase();
    return (
      (l.name  ?? "").toLowerCase().includes(q) ||
      (l.email ?? "").toLowerCase().includes(q) ||
      (l.phone ?? "").toLowerCase().includes(q) ||
      (l.icp_name ?? "").toLowerCase().includes(q)
    );
  });

  const exportCSV = () => {
    const header = "Name,Email,Phone,ICP,Source,Score,Messages,Date";
    const rows = filtered.map((l) =>
      [l.name, l.email, l.phone, l.icp_name, l.referral_source, l.lead_score, l.message_count, l.created_at]
        .map((v) => `"${v ?? ""}"`)
        .join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "lssu_leads.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Leads ({leads.length})</h1>
        <button
          onClick={exportCSV}
          className="flex items-center gap-2 text-sm bg-[#003F6B] text-white px-4 py-2 rounded-lg hover:bg-[#002d4e] transition-colors"
        >
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Search + Score filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, phone, or ICP…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003F6B]/30"
          />
        </div>
        <select
          value={scoreFilter}
          onChange={(e) => setScoreFilter(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#003F6B]/30 bg-white"
        >
          <option value="">All scores</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm text-center py-12">Loading leads…</p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left">ICP</th>
                <th className="px-4 py-3 text-left">Source</th>
                <th className="px-4 py-3 text-left">Score</th>
                <th className="px-4 py-3 text-left">Msgs</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.session_id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium">{l.name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-blue-600">{l.email ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3">{l.phone ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3"><IcpBadge name={l.icp_name} /></td>
                  <td className="px-4 py-3"><SourceBadge source={l.referral_source} /></td>
                  <td className="px-4 py-3"><ScoreBadge score={l.lead_score} /></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{l.message_count ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {l.created_at ? format(new Date(l.created_at), "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setDeleteTarget(l)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"
                      title="Delete lead"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-gray-300 py-12">
                    {query ? "No leads match your search." : "No leads captured yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-5 space-y-3">
              <h2 className="font-semibold text-gray-800">Delete lead?</h2>
              <p className="text-sm text-gray-500">
                This permanently removes the session for{" "}
                <span className="font-medium text-gray-700">{deleteTarget.name ?? "Anonymous"}</span>{" "}
                and all its messages. This cannot be undone.
              </p>
            </div>
            <div className="px-6 pb-5 flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-5 py-2 text-sm rounded-lg bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
