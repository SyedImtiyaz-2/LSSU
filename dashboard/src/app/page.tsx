"use client";
import { useEffect, useState } from "react";
import { api, DashboardStats, ICPBreakdown, Session } from "@/lib/api";
import StatsCard from "@/components/StatsCard";
import Badge from "@/components/Badge";
import {
  Users, MessageSquare, CheckCircle, AlertCircle, Mail, Phone,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { formatDistanceToNow } from "date-fns";

export default function OverviewPage() {
  const [stats, setStats]     = useState<DashboardStats | null>(null);
  const [icp, setIcp]         = useState<ICPBreakdown[]>([]);
  const [recent, setRecent]   = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.stats(), api.icpBreakdown(), api.recentActivity()])
      .then(([s, i, r]) => { setStats(s); setIcp(i); setRecent(r); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-gray-400 text-sm py-12 text-center">Loading dashboard…</div>;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Overview</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatsCard title="Total Sessions"   value={stats?.total_sessions ?? 0}   icon={Users}         color="navy"  />
        <StatsCard title="Total Messages"   value={stats?.total_messages ?? 0}   icon={MessageSquare} color="navy"  />
        <StatsCard title="Resolution Rate"  value={`${stats?.resolution_rate_pct ?? 0}%`} icon={CheckCircle} color="green" />
        <StatsCard title="Escalated"        value={stats?.escalated_sessions ?? 0} icon={AlertCircle}  color="red"   />
        <StatsCard title="Leads w/ Email"   value={stats?.leads_with_email ?? 0} icon={Mail}          color="gold"  />
        <StatsCard title="Leads w/ Phone"   value={stats?.leads_with_phone ?? 0} icon={Phone}         color="gold"  />
        <StatsCard title="Leads w/ Name"    value={stats?.leads_with_name ?? 0}  icon={Users}         color="gold"  />
        <StatsCard title="Resolved"         value={stats?.resolved_sessions ?? 0} icon={CheckCircle}  color="green" />
      </div>

      {/* ICP Bar chart */}
      {icp.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Sessions by ICP</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={icp} layout="vertical" margin={{ left: 24 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="icp_name"
                width={200}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(val: number, name: string) =>
                  name === "total_sessions" ? [`${val} sessions`, "Sessions"] : [`${val}`, name]
                }
              />
              <Bar dataKey="total_sessions" radius={[0, 4, 4, 0]}>
                {icp.map((_, i) => (
                  <Cell key={i} fill={i % 2 === 0 ? "#003F6B" : "#C8992A"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4">Recent Sessions</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">ICP</th>
                <th className="pb-2 pr-4">Messages</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">When</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((s) => (
                <tr key={s.session_id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-2 pr-4 font-medium">{s.name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="py-2 pr-4 text-gray-500 text-xs">{s.icp_name ?? "Unknown"}</td>
                  <td className="py-2 pr-4">{s.message_count}</td>
                  <td className="py-2 pr-4">
                    {s.human_requested
                      ? <Badge label="Escalated" variant="red" />
                      : s.resolved
                      ? <Badge label="Resolved" variant="green" />
                      : <Badge label="Active" variant="blue" />}
                  </td>
                  <td className="py-2 text-gray-400 text-xs">
                    {s.created_at ? formatDistanceToNow(new Date(s.created_at), { addSuffix: true }) : "—"}
                  </td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={5} className="text-center text-gray-300 py-8">No sessions yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
