"use client";
import { useEffect, useState } from "react";
import { api, Lead } from "@/lib/api";
import { Download, Search } from "lucide-react";
import { format } from "date-fns";

export default function LeadsPage() {
  const [leads, setLeads]   = useState<Lead[]>([]);
  const [query, setQuery]   = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.leads().then((r) => setLeads(r.leads)).finally(() => setLoading(false));
  }, []);

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
    const header = "Name,Email,Phone,ICP,Source,Date";
    const rows = filtered.map((l) =>
      [l.name, l.email, l.phone, l.icp_name, l.referral_source, l.created_at]
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

      {/* Search */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, email, phone, or ICP…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#003F6B]/30"
        />
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
                <th className="px-4 py-3 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.session_id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium">{l.name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-blue-600">{l.email ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3">{l.phone ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{l.icp_name ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{l.referral_source ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {l.created_at ? format(new Date(l.created_at), "MMM d, yyyy") : "—"}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-300 py-12">
                    {query ? "No leads match your search." : "No leads captured yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
