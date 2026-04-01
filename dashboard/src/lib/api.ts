const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_sessions: number;
  resolved_sessions: number;
  escalated_sessions: number;
  leads_with_email: number;
  leads_with_phone: number;
  leads_with_name: number;
  resolution_rate_pct: number | null;
  total_messages: number;
}

export interface ICPBreakdown {
  icp_id: number | null;
  icp_name: string;
  total_sessions: number;
  leads_captured: number;
  resolution_rate_pct: number | null;
}

export interface Session {
  session_id: string;
  page_slug: string | null;
  icp_id: number | null;
  icp_name: string | null;
  referral_source: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  resolved: boolean;
  human_requested: boolean;
  unresolved_query: string | null;
  chat_summary: string | null;
  message_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface Lead {
  session_id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  icp_name: string | null;
  page_slug: string | null;
  referral_source: string | null;
  created_at: string | null;
}

export interface Message {
  id: string;
  session_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  rag_score: number | null;
  created_at: string | null;
}

// ── API calls ────────────────────────────────────────────────────────────────

export const api = {
  stats: ()           => fetchJSON<DashboardStats>("/dashboard/stats"),
  icpBreakdown: ()    => fetchJSON<ICPBreakdown[]>("/dashboard/icp-breakdown"),
  recentActivity: ()  => fetchJSON<Session[]>("/dashboard/recent-activity"),
  sessions: (params?: { icp_id?: number; resolved?: boolean; human_requested?: boolean; limit?: number; offset?: number }) => {
    const q = new URLSearchParams();
    if (params?.icp_id !== undefined) q.set("icp_id", String(params.icp_id));
    if (params?.resolved !== undefined) q.set("resolved", String(params.resolved));
    if (params?.human_requested !== undefined) q.set("human_requested", String(params.human_requested));
    if (params?.limit) q.set("limit", String(params.limit));
    if (params?.offset) q.set("offset", String(params.offset));
    return fetchJSON<{ sessions: Session[]; offset: number; limit: number }>(`/dashboard/sessions?${q}`);
  },
  leads: (offset = 0, limit = 100) =>
    fetchJSON<{ leads: Lead[] }>(`/dashboard/leads?offset=${offset}&limit=${limit}`),
  sessionMessages: (id: string) =>
    fetchJSON<{ session: Session; messages: Message[] }>(`/dashboard/sessions/${id}/messages`),
  updateSession: (id: string, patch: Partial<Pick<Session, "resolved" | "human_requested" | "name" | "email" | "phone" | "chat_summary">>) =>
    fetchJSON<Session>(`/dashboard/sessions/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  deleteSession: (id: string) =>
    fetchJSON<{ deleted: string }>(`/dashboard/sessions/${id}`, { method: "DELETE" }),
};
